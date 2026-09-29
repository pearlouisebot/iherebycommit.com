// Hot or Bot drop-in client for iOS.
//
// This repo (iherebycommit.com) has no iOS app. Copy this file into an app
// target and add the supabase-swift package, 2.0 or newer:
// https://github.com/supabase/supabase-swift
//
// Uses the same Supabase project as the waitlist. The key below is the
// publishable key already shipped on the website. Do not put a service-role
// key in this file.
//
// Anonymous sign-ins are currently off in the project dashboard. `castVote`
// throws `HotOrBotError.anonymousSignInDisabled` in that case. The deck still
// loads. `HotOrBotDeckView` shows a short message and keeps playing.

import AVFoundation
import Foundation
import Supabase

#if os(iOS)
import SwiftUI
import UIKit
#endif

enum HotOrBotConfig {
    static let supabaseURL = URL(string: "https://dqrmyqmpqnlemkwdndsf.supabase.co")!
    /// Publishable key (`sb_publishable_...`). Same value as the website.
    static let publishableKey = "sb_publishable_4vVukqsYa3MHQeq0ZDcInQ_x6CxeoYG"
    /// Passed to `get_swipe_deck`. The server clamps the value to 1...50.
    static let deckLimit = 10
}

enum HotOrBotError: Error, LocalizedError {
    case anonymousSignInDisabled
    case notAuthenticated
    case invalidVote
    case unknownProfile
    case server(String)

    var errorDescription: String? {
        switch self {
        case .anonymousSignInDisabled, .notAuthenticated:
            return "Voting isn't open yet — sign-in is turned off. You can still watch the deck."
        case .invalidVote:
            return "That vote wasn't accepted."
        case .unknownProfile:
            return "That clip is no longer in the deck."
        case .server(let message):
            return message
        }
    }
}

/// One card from `get_swipe_deck`. Field names match the RPC columns.
struct HotOrBotDeckCard: Decodable, Identifiable, Sendable {
    let id: UUID
    let slug: String
    let video_url: URL
    let poster_url: URL?
    let duration_s: Double
    let width: Int
    let height: Int
}

/// Row returned by `cast_swipe_vote`.
struct HotOrBotVoteRow: Decodable, Sendable {
    let id: Int64
    let user_id: UUID
    let video_profile_id: UUID
    let vote: String
    let dwell_ms: Int?
    let client: String?
}

struct HotOrBotTally: Decodable, Identifiable, Sendable {
    let video_profile_id: UUID
    let slug: String
    let votes_total: Int
    let hot_count: Int
    let not_count: Int
    let bot_count: Int
    let human_count: Int
    let pct_hot: Double?
    let pct_guessed_correctly: Double?
    var id: UUID { video_profile_id }
}

private struct HotOrBotDeckParams: Encodable {
    let p_limit: Int
}

private struct HotOrBotVoteParams: Encodable {
    let p_video_profile_id: UUID
    let p_vote: String
    let p_dwell_ms: Int?
    let p_client: String?
}

private struct HotOrBotEmptyParams: Encodable {}

/// Calls the live Hot or Bot RPCs. Safe to use logged out for the deck.
/// Voting calls `auth.signInAnonymously()` when there is no session.
final class HotOrBotClient {
    let supabase: SupabaseClient

    init(
        supabaseURL: URL = HotOrBotConfig.supabaseURL,
        publishableKey: String = HotOrBotConfig.publishableKey
    ) {
        supabase = SupabaseClient(supabaseURL: supabaseURL, supabaseKey: publishableKey)
    }

    /// Active clips the caller has not already voted on. No session required.
    func deck(limit: Int = HotOrBotConfig.deckLimit) async throws -> [HotOrBotDeckCard] {
        let rows: [HotOrBotDeckCard] = try await supabase
            .rpc("get_swipe_deck", params: HotOrBotDeckParams(p_limit: limit))
            .execute()
            .value
        return rows
    }

    /// Latest vote wins. Requires a session. Sends `p_client` = `ios` by default.
    /// `dwellMs` is milliseconds from video start to the vote.
    func castVote(
        videoProfileId: UUID,
        vote: String,
        dwellMs: Int?,
        clientName: String = "ios"
    ) async throws -> HotOrBotVoteRow {
        let normalized = vote.lowercased()
        guard ["hot", "not", "bot", "human"].contains(normalized) else {
            throw HotOrBotError.invalidVote
        }
        if let dwellMs, dwellMs < 0 {
            throw HotOrBotError.invalidVote
        }
        try await ensureAnonymousSession()
        let params = HotOrBotVoteParams(
            p_video_profile_id: videoProfileId,
            p_vote: normalized,
            p_dwell_ms: dwellMs,
            p_client: clientName
        )
        do {
            let row: HotOrBotVoteRow = try await supabase
                .rpc("cast_swipe_vote", params: params)
                .execute()
                .value
            return row
        } catch {
            throw Self.mapVoteError(error)
        }
    }

    /// Signed-in only. Ground truth (`is_bot`) is never returned.
    func tallies() async throws -> [HotOrBotTally] {
        try await ensureAnonymousSession()
        let rows: [HotOrBotTally] = try await supabase
            .rpc("get_video_profile_tallies", params: HotOrBotEmptyParams())
            .execute()
            .value
        return rows
    }

    func ensureAnonymousSession() async throws {
        if (try? await supabase.auth.session) != nil { return }
        do {
            _ = try await supabase.auth.signInAnonymously()
        } catch {
            if Self.isAnonymousDisabled(error) {
                throw HotOrBotError.anonymousSignInDisabled
            }
            throw error
        }
    }

    private static func isAnonymousDisabled(_ error: Error) -> Bool {
        let text = String(describing: error)
        return text.contains("anonymous_provider_disabled")
            || text.localizedCaseInsensitiveContains("Anonymous sign-ins are disabled")
    }

    private static func mapVoteError(_ error: Error) -> Error {
        if error is HotOrBotError { return error }
        let text = String(describing: error)
        if isAnonymousDisabled(error) { return HotOrBotError.anonymousSignInDisabled }
        if text.contains("28000") || text.localizedCaseInsensitiveContains("not authenticated") {
            return HotOrBotError.notAuthenticated
        }
        if text.contains("22023") { return HotOrBotError.invalidVote }
        if text.contains("P0002") { return HotOrBotError.unknownProfile }
        return error
    }
}

#if os(iOS)
/// Minimal swipe deck. Present `HotOrBotDeckView()` from any screen.
/// One player, muted until the viewer taps for sound. Buttons and a
/// horizontal drag cast a single vote (`hot` / `not` / `bot` / `human`).
@MainActor
final class HotOrBotDeckModel: ObservableObject {
    @Published private(set) var cards: [HotOrBotDeckCard] = []
    @Published private(set) var index = 0
    @Published private(set) var banner: String?
    @Published private(set) var phase: Phase = .loading
    @Published var soundOn = false

    enum Phase { case loading, playing, empty, failed }

    let player = AVQueuePlayer()
    private let api: HotOrBotClient
    private let deckLimit: Int
    private var looper: AVPlayerLooper?
    private var videoStartedAt: Date?
    private var voting = false
    private var sawAuthBlock = false
    private var posterTask: URLSessionDataTask?

    init(api: HotOrBotClient = HotOrBotClient(), deckLimit: Int = HotOrBotConfig.deckLimit) {
        self.api = api
        self.deckLimit = deckLimit
        player.isMuted = true
    }

    var current: HotOrBotDeckCard? {
        cards.indices.contains(index) ? cards[index] : nil
    }

    func load() async {
        phase = .loading
        do {
            cards = try await api.deck(limit: deckLimit)
            index = 0
            if cards.isEmpty {
                phase = .empty
            } else {
                phase = .playing
                playCurrent()
            }
        } catch {
            phase = .failed
        }
    }

    func toggleSound() {
        soundOn.toggle()
        player.isMuted = !soundOn
        if player.timeControlStatus != .playing {
            player.play()
        }
    }

    func vote(_ choice: String) async {
        guard !voting, let card = current else { return }
        voting = true
        defer { voting = false }
        let dwell = dwellMs()
        do {
            _ = try await api.castVote(videoProfileId: card.id, vote: choice, dwellMs: dwell, clientName: "ios")
            banner = nil
            advance()
        } catch HotOrBotError.anonymousSignInDisabled, HotOrBotError.notAuthenticated {
            sawAuthBlock = true
            banner = "Voting isn't open yet — sign-in is turned off. You can still watch the deck."
            advance()
        } catch {
            banner = "That vote didn't save. You can try again."
        }
    }

    private func advance() {
        index += 1
        if current == nil {
            stop()
            phase = .empty
        } else {
            playCurrent()
        }
    }

    private func playCurrent() {
        guard let card = current else { return }
        looper?.disableLooping()
        looper = nil
        player.removeAllItems()
        let item = AVPlayerItem(url: card.video_url)
        player.isMuted = !soundOn
        looper = AVPlayerLooper(player: player, templateItem: item)
        videoStartedAt = nil
        player.play()
        videoStartedAt = Date()
        preloadNextPoster()
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    private func stop() {
        looper?.disableLooping()
        looper = nil
        player.pause()
        player.removeAllItems()
    }

    private func dwellMs() -> Int {
        guard let videoStartedAt else { return 0 }
        return max(0, Int(Date().timeIntervalSince(videoStartedAt) * 1000))
    }

    private func preloadNextPoster() {
        posterTask?.cancel()
        let next = index + 1
        guard cards.indices.contains(next), let url = cards[next].poster_url else { return }
        let request = URLRequest(url: url, cachePolicy: .returnCacheDataElseLoad)
        let task = URLSession.shared.dataTask(with: request)
        posterTask = task
        task.resume()
    }

    var emptyDetail: String {
        if sawAuthBlock {
            return "Your votes were not saved because sign-in is turned off. These clips will still be here when voting opens."
        }
        return "Nothing left to vote on right now."
    }
}

struct HotOrBotDeckView: View {
    @StateObject private var model = HotOrBotDeckModel()
    @State private var dragX: CGFloat = 0

    var body: some View {
        ZStack {
            Color(red: 0.055, green: 0.055, blue: 0.055).ignoresSafeArea()
            VStack(spacing: 0) {
                header
                ZStack {
                    switch model.phase {
                    case .loading:
                        status(title: "Loading the deck…", body: "Pulling the next set of clips.")
                    case .failed:
                        status(title: "Couldn’t load the deck", body: "Check your connection and try again.")
                    case .empty:
                        status(title: "You've seen them all", body: model.emptyDetail)
                    case .playing:
                        card
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                if model.phase == .playing {
                    controls
                }
            }
        }
        .task { await model.load() }
    }

    private var header: some View {
        HStack {
            Text("HOT OR BOT")
                .font(.system(size: 28, weight: .regular, design: .default))
                .kerning(1)
            Spacer()
            if model.phase == .playing {
                Text("\(model.index + 1) / \(model.cards.count)")
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(.secondary)
            }
        }
        .foregroundStyle(Color(red: 0.94, green: 0.925, blue: 0.88))
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    private var card: some View {
        ZStack(alignment: .bottom) {
            if let poster = model.current?.poster_url {
                AsyncImage(url: poster) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Color(red: 0.08, green: 0.08, blue: 0.08)
                }
                .ignoresSafeArea(edges: .horizontal)
            }
            HotOrBotPlayerView(player: model.player)
                .onTapGesture { model.toggleSound() }
            if let banner = model.banner {
                Text(banner)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundStyle(Color(red: 0.94, green: 0.925, blue: 0.88))
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(red: 0.055, green: 0.055, blue: 0.055))
                    .overlay(Rectangle().stroke(Color(red: 0.784, green: 0.945, blue: 0.208), lineWidth: 1))
                    .padding(12)
                    .frame(maxHeight: .infinity, alignment: .top)
            }
            Button(model.soundOn ? "Sound on" : "Tap for sound") {
                model.toggleSound()
            }
            .font(.system(size: 11, design: .monospaced))
            .textCase(.uppercase)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color.black.opacity(0.7))
            .foregroundStyle(Color(red: 0.94, green: 0.925, blue: 0.88))
            .clipShape(Capsule())
            .padding(.bottom, 14)
        }
        .clipped()
        .offset(x: dragX)
        .rotationEffect(.degrees(Double(dragX / 18)))
        .gesture(
            DragGesture()
                .onChanged { dragX = $0.translation.width }
                .onEnded { value in
                    let dx = value.translation.width
                    dragX = 0
                    guard abs(dx) > 72, abs(dx) > abs(value.translation.height) else { return }
                    Task { await model.vote(dx > 0 ? "hot" : "not") }
                }
        )
    }

    private var controls: some View {
        VStack(spacing: 8) {
            HStack(spacing: 8) {
                voteButton("Not", "not")
                voteButton("Hot", "hot")
            }
            HStack(spacing: 8) {
                voteButton("Bot", "bot")
                voteButton("Human", "human")
            }
            Text("Swipe left not · right hot · one vote each")
                .font(.system(size: 10, design: .monospaced))
                .textCase(.uppercase)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private func voteButton(_ title: String, _ vote: String) -> some View {
        Button(title) {
            Task { await model.vote(vote) }
        }
        .font(.system(size: 22, weight: .semibold))
        .textCase(.uppercase)
        .frame(maxWidth: .infinity, minHeight: 52)
        .background(vote == "hot" ? Color(red: 0.784, green: 0.945, blue: 0.208) : Color.clear)
        .foregroundStyle(vote == "hot" ? Color.black : Color(red: 0.94, green: 0.925, blue: 0.88))
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.white.opacity(0.25), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }

    private func status(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("DECK")
                .font(.system(size: 11, design: .monospaced))
                .kerning(2)
                .foregroundStyle(.secondary)
            Text(title)
                .font(.system(size: 44, weight: .bold))
                .foregroundStyle(Color(red: 0.94, green: 0.925, blue: 0.88))
            Text(body)
                .font(.system(size: 14, design: .monospaced))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(24)
    }
}

struct HotOrBotPlayerView: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context: Context) -> HotOrBotPlayerUIView {
        let view = HotOrBotPlayerUIView()
        view.playerLayer.player = player
        view.playerLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ uiView: HotOrBotPlayerUIView, context: Context) {
        uiView.playerLayer.player = player
    }
}

final class HotOrBotPlayerUIView: UIView {
    override static var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
}
#endif
