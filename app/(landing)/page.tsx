import Link from 'next/link';
import { getSupabaseAdminClient, fetchAllRows } from '@/lib/supabase';

export const revalidate = 300; // 5-minute ISR cache

async function getStats() {
  try {
    const supabase = getSupabaseAdminClient();

    // Use fetchAllRows (same as admin endpoint) to paginate past Supabase's 1000-row limit
    const answers = await fetchAllRows(({ from, to }) =>
      supabase.from('answers').select('correct, player_id').eq('game_mode', 'research').range(from, to),
    );

    const totalAnswers = answers.length;
    const correctAnswers = answers.filter(a => a.correct).length;
    const distinctParticipants = new Set(
      answers.filter(a => a.player_id).map(a => a.player_id)
    ).size;

    return {
      participants: distinctParticipants,
      totalAnswers,
      overallAccuracy: totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0,
    };
  } catch {
    return { participants: 0, totalAnswers: 0, overallAccuracy: 0 };
  }
}

export default async function LandingPage() {
  const stats = await getStats();

  return (
    <div className="overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 py-4 px-6 flex items-center justify-between bg-[rgba(9,9,11,0.8)] backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5 font-bold text-[15px] tracking-tight">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 32 32" className="shrink-0">
            <rect width="32" height="32" rx="6" fill="#060c06"/>
            <rect x="1" y="1" width="30" height="30" rx="5" fill="none" stroke="#00ff41" strokeOpacity="0.4" strokeWidth="1"/>
            <rect x="5" y="7" width="22" height="3" rx="1" fill="#00ff41" fillOpacity="0.15"/>
            <text x="16" y="24" textAnchor="middle" fontFamily="monospace" fontWeight="900" fontSize="16" fill="#00ff41" letterSpacing="1">TT</text>
            <rect x="24" y="22" width="2" height="3" fill="#00ff41" opacity="0.8"/>
          </svg>
          Threat Terminal
        </div>
        <div className="hidden sm:flex gap-6 items-center">
          <a
            href="#how"
            className="text-[#a1a1aa] text-sm hover:text-white transition-colors"
          >
            How It Works
          </a>
          <Link
            href="/play"
            className="px-[18px] py-2 bg-[#fafafa] text-[#09090b] text-[13px] font-semibold rounded-lg hover:bg-white transition-colors"
          >
            Start Playing
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="min-h-screen flex items-center justify-center pt-[120px] pb-20 px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(0,255,65,0.06)_0%,transparent_70%)] pointer-events-none" />
        <div className="max-w-[800px] text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.15)] rounded-full text-xs text-[#00ff41] font-medium font-[family-name:var(--font-jetbrains)] mb-6">
            <span className="w-1.5 h-1.5 bg-[#00ff41] rounded-full animate-pulse" />
            Live research study — {stats.participants}+ participants
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-[-1.5px] leading-[1.1] mb-5">
            Can you spot <span className="text-[#00ff41]">AI&#8209;generated</span> phishing?
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-[#a1a1aa] max-w-[540px] mx-auto mb-9 leading-relaxed">
            Grammar is perfect. Spelling is flawless. The only way to catch
            modern phishing is forensic analysis. Test your skills and contribute
            to real research.
          </p>

          {/* Buttons */}
          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href="/play"
              className="px-8 py-3.5 bg-[#00ff41] text-black text-[15px] font-bold rounded-[10px] shadow-[0_0_20px_rgba(0,255,65,0.2)] hover:shadow-[0_0_30px_rgba(0,255,65,0.35)] hover:-translate-y-px transition-all"
            >
              Take the Challenge
            </Link>
            <a
              href="#research"
              className="px-8 py-3.5 text-[#a1a1aa] text-[15px] font-semibold rounded-[10px] border border-white/10 hover:text-white hover:border-white/20 transition-all"
            >
              Learn More
            </a>
          </div>
          <div className="mt-4 text-[13px] text-[#71717a]">
            Already have an account?{' '}
            <Link href="/play" className="text-[#a1a1aa] hover:text-white underline transition-colors">
              Sign in
            </Link>
          </div>

          {/* Terminal Preview */}
          <div className="mt-[60px] max-w-[420px] mx-auto bg-[#060c06] border border-[rgba(0,255,65,0.15)] rounded-xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.5),0_0_40px_rgba(0,255,65,0.05)]">
            {/* Title bar */}
            <div className="px-3.5 py-2.5 bg-[rgba(0,255,65,0.04)] border-b border-[rgba(0,255,65,0.1)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[rgba(255,51,51,0.6)]" />
              <span className="w-2 h-2 rounded-full bg-[rgba(255,170,0,0.6)]" />
              <span className="w-2 h-2 rounded-full bg-[rgba(0,255,65,0.6)]" />
              <span className="flex-1 text-center font-[family-name:var(--font-jetbrains)] text-[11px] text-[#00aa28] tracking-wider">
                INCOMING_EMAIL
              </span>
            </div>
            {/* Body */}
            <div className="p-4 font-[family-name:var(--font-jetbrains)] text-left">
              <div className="flex gap-2 text-xs mb-0.5">
                <span className="text-[#33bb55] w-10 shrink-0">FROM:</span>
                <span className="text-[#00ff41]">IT Security Team</span>
              </div>
              <div className="flex gap-2 text-xs mb-0.5">
                <span className="text-[#33bb55] w-10 shrink-0">SUBJ:</span>
                <span className="text-[#00ff41]">
                  Mandatory: Update your credentials before Friday
                </span>
              </div>
              <div className="flex gap-2 text-xs mb-0.5">
                <span className="text-[#33bb55] w-10 shrink-0">AUTH:</span>
                <span className="text-amber-400">UNVERIFIED</span>
              </div>
              <div className="mt-3 pt-2.5 text-[11px] text-[#33bb55] leading-relaxed border-t border-[rgba(0,255,65,0.08)]">
                Your account credentials will expire on Friday. Please update
                them immediately at{' '}
                <span className="text-amber-400 underline">
                  https://portal-update.company-it.net/verify
                </span>{' '}
                to avoid service interruption.
              </div>
              <div className="mt-3.5 flex gap-2 pointer-events-none">
                <div className="flex-1 py-2.5 text-center font-[family-name:var(--font-jetbrains)] text-[11px] font-bold tracking-wider border border-[rgba(255,51,51,0.4)] text-[#ff3333] rounded-md">
                  PHISHING
                </div>
                <div className="flex-1 py-2.5 text-center font-[family-name:var(--font-jetbrains)] text-[11px] font-bold tracking-wider border border-[rgba(0,255,65,0.3)] text-[#00ff41] rounded-md">
                  LEGIT
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6 border-t border-white/[0.06]">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-[28px] font-bold text-center mb-2 tracking-tight">
            The numbers so far
          </h2>
          <p className="text-center text-[#71717a] text-[15px] mb-12">
            Real data from real participants
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 text-center">
              <div className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-[#00ff41] to-[#00cc66] bg-clip-text text-transparent">
                {stats.participants.toLocaleString()}
              </div>
              <div className="text-[13px] text-[#71717a] mt-1 font-medium">
                Participants
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 text-center">
              <div className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-[#00ff41] to-[#00cc66] bg-clip-text text-transparent">
                {stats.overallAccuracy}%
              </div>
              <div className="text-[13px] text-[#71717a] mt-1 font-medium">
                Average accuracy
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 text-center">
              <div className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-[#00ff41] to-[#00cc66] bg-clip-text text-transparent">
                {stats.totalAnswers.toLocaleString()}
              </div>
              <div className="text-[13px] text-[#71717a] mt-1 font-medium">
                Answers submitted
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how" className="py-20 px-6 border-t border-white/[0.06]">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-[28px] font-bold text-center mb-12 tracking-tight">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-10 h-10 rounded-[10px] bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.15)] inline-flex items-center justify-center font-[family-name:var(--font-jetbrains)] text-base font-bold text-[#00ff41] mb-4">
                1
              </div>
              <h3 className="text-base font-bold mb-2">Read the email</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                You&apos;ll see AI-generated emails, some phishing, some
                legitimate. Grammar and spelling will be perfect in both.
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-[10px] bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.15)] inline-flex items-center justify-center font-[family-name:var(--font-jetbrains)] text-base font-bold text-[#00ff41] mb-4">
                2
              </div>
              <h3 className="text-base font-bold mb-2">Make your call</h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                Use forensic tools like sender verification, URL inspection, and
                header analysis to decide: phishing or legit?
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 rounded-[10px] bg-[rgba(0,255,65,0.08)] border border-[rgba(0,255,65,0.15)] inline-flex items-center justify-center font-[family-name:var(--font-jetbrains)] text-base font-bold text-[#00ff41] mb-4">
                3
              </div>
              <h3 className="text-base font-bold mb-2">
                See how you compare
              </h3>
              <p className="text-sm text-[#a1a1aa] leading-relaxed">
                Get instant feedback, earn XP, climb the leaderboard. After 30
                answers, unlock Expert mode and full research analytics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* About the Research */}
      <section
        id="research"
        className="py-20 px-6 border-t border-white/[0.06]"
      >
        <div className="max-w-[640px] mx-auto text-center">
          <h2 className="text-[28px] font-bold mb-4 tracking-tight">
            About the research
          </h2>
          <p className="text-[15px] text-[#a1a1aa] leading-relaxed mb-4">
            Threat Terminal is a live research study on how people detect
            AI-generated phishing. When grammar and spelling are no longer
            reliable signals, what do humans actually look for?
          </p>
          <p className="text-[15px] text-[#a1a1aa] leading-relaxed mb-4">
            Every answer you submit contributes to real data. Your responses
            help us understand which forensic cues matter most when traditional
            red flags have been eliminated by AI.
          </p>
          <div className="text-[13px] text-[#71717a] mt-6">
            A research project by{' '}
            <a
              href="https://scottaltiparmak.com/research"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00ff41] hover:underline"
            >
              Scott Altiparmak
            </a>
            {' · '}
            <a
              href="https://scottaltiparmak.com/research"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#71717a] hover:text-[#a1a1aa] hover:underline transition-colors"
            >
              Read more
            </a>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 pb-16 px-6 border-t border-white/[0.06] text-center">
        <h2 className="text-[32px] font-extrabold mb-3 tracking-tight">
          Think you&apos;d do better?
        </h2>
        <p className="text-[#a1a1aa] text-base mb-8">
          Most people score under 65%. Five minutes. Thirty emails.
        </p>
        <Link
          href="/play"
          className="inline-block px-8 py-3.5 bg-[#00ff41] text-black text-[15px] font-bold rounded-[10px] shadow-[0_0_20px_rgba(0,255,65,0.2)] hover:shadow-[0_0_30px_rgba(0,255,65,0.35)] hover:-translate-y-px transition-all"
        >
          Take the Challenge &rarr;
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/[0.06] text-center">
        <p className="text-[12px] text-[#52525b] max-w-[500px] mx-auto leading-relaxed mb-3">
          Threat Terminal is for educational and research purposes only. It is not
          a substitute for professional cybersecurity training. All emails shown
          are fictional and AI-generated. Brand names are used for realism and
          do not imply endorsement or affiliation.
        </p>
        <div className="flex items-center justify-center gap-4 text-[12px] text-[#52525b]">
          <Link href="/privacy" className="hover:text-[#a1a1aa] transition-colors">
            Privacy Policy
          </Link>
          <span className="text-[#3f3f46]">|</span>
          <Link href="/terms" className="hover:text-[#a1a1aa] transition-colors">
            Terms of Use
          </Link>
          <span className="text-[#3f3f46]">|</span>
          <Link href="/methodology" className="hover:text-[#a1a1aa] transition-colors">
            Methodology
          </Link>
        </div>
      </footer>
    </div>
  );
}
