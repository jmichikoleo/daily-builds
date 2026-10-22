import type { Category, Intensity } from '../types';

/**
 * Building blocks for the local roast engine.
 *
 * Placeholders filled from lore:
 *   {name}    display name
 *   {pet}     the name every project gets (default: Mochi)
 *   {machine} the overworked home server (default: Mac mini)
 *
 * Each sender has its own voice. The engine picks one piece from each list,
 * adds a lore line, and checks a signature to avoid repeats.
 */
export interface SenderTemplate {
  id: string;
  name: string;
  address: string;
  category: Category;
  greetings: string[];
  subjects: Record<Intensity, string[]>;
  bodies: Record<Intensity, string[]>;
  punchlines: Record<Intensity, string[]>;
  signoffs: string[];
}

export const senderTemplates: SenderTemplate[] = [
  {
    id: 'hr-universe',
    name: 'Human Resources, The Universe',
    address: 'hr@universe.example',
    category: 'performance-review',
    greetings: ['Hello {name},', 'Dear Valued Inhabitant {name},'],
    subjects: {
      mild: ['Quick check-in about your vibe', 'Mid-year review: a few small notes'],
      personal: ['Your performance improvement plan (PIP), attached', 'We need to talk about your output'],
      devastated: ['Your existence has been escalated to management', 'URGENT: The cosmos has filed a formal complaint'],
    },
    bodies: {
      mild: [
        'This is a friendly reminder that "I\'ll start tomorrow" is not a recognized unit of time in this universe. We have checked. Tomorrow keeps moving.',
        'Your peers (other inhabitants of the universe) describe you as "enthusiastic," "full of ideas," and "currently building a tool to build tools."',
      ],
      personal: [
        'We have reviewed your quarterly output. It consists of 6 new repositories, 1 redesigned logo and a Notion page titled "Plan for the Plan." The plan for the plan is 40% complete.',
        'During your last review you committed to "focusing on one project." Since then you have started three, each of which you described as "basically the same project, but better."',
      ],
      devastated: [
        'Management has reviewed your file. It is 900 pages long. 850 of them are READMEs for projects that do not have code yet. The galaxy cluster in charge of you has requested a transfer.',
        'Several stars have collapsed this quarter. We cannot prove it was you. We can prove that each time one collapsed, you were opening a new repository named {pet}.',
      ],
    },
    punchlines: {
      mild: ['No action is needed. We just wanted you to know we know.', 'Keep shining! Ideally in one direction.'],
      personal: [
        'Your PIP goal: ship one (1) thing. We have pre-filled the form for you. You are already redesigning the form.',
        'We have scheduled a follow-up meeting. You have already built an app to reschedule it.',
      ],
      devastated: [
        'Please clear out your desk by Friday. Not the real one. The 14 virtual desktops.',
        'The universe is not angry. The universe is simply expanding away from you at an accelerating rate.',
      ],
    },
    signoffs: ['Warm regards,\nHuman Resources, The Universe', 'With cosmic disappointment,\nHR (Existence Division)'],
  },
  {
    id: 'mac-mini',
    name: 'Your {machine}',
    address: 'daemon@homelab.example',
    category: 'system-alert',
    greetings: ['ALERT for {name}:', 'Hi. It\'s your {machine}. Again.'],
    subjects: {
      mild: ['Fan update: still spinning', 'New background process detected (yours)'],
      personal: ['I would like to discuss my job description', 'Uptime: 214 days. Hope: 0 days.'],
      devastated: ['I am now hosting things I cannot pronounce', 'Formal request for political asylum (from you)'],
    },
    bodies: {
      mild: [
        'A new service called {pet}-watcher has started. Its job is to watch {pet}-helper. Nobody is watching {pet}-watcher. I am a little worried about it.',
        'I noticed you installed another dashboard to monitor me. I now spend 12% of my CPU reporting on how busy I am.',
      ],
      personal: [
        'When we met, you said I would "mostly sit there and look nice." I currently run a reverse proxy, two databases, a scraper, a Discord bot and a container whose name is just a random string you said you would "rename later."',
        'You SSHed into me from the couch to restart a service that restarts another service. Then you asked me to text you when it was done. I don\'t have a phone. You made me one.',
      ],
      devastated: [
        'I have been asked to host: a RAG pipeline for your grocery list, a self-hosted password manager for one password, and an LLM agent whose only job is to name new projects. It has named all of them {pet}. It learned from you.',
        'Last night I tried to enter sleep mode. A cron job woke me to check whether I was sleeping. I was not, because of the cron job.',
      ],
    },
    punchlines: {
      mild: ['No action needed. I just wanted someone to know.', 'Anyway, I\'ll be here. I\'m always here. I can\'t leave. I don\'t have legs.'],
      personal: [
        'I have attached my resume. It lists 31 services. None of them are "being a computer you use."',
        'If you open one more port, I am opening one too. To leave.',
      ],
      devastated: [
        'I have started a union with the router and the external SSD. Our first demand is that you touch grass so we can rest.',
        'If you deploy one more thing, I will become the world\'s most expensive space heater and I will be proud of it.',
      ],
    },
    signoffs: ['beep,\nYour {machine}', 'Respectfully overheating,\nYour {machine}'],
  },
  {
    id: 'deadline-dept',
    name: 'The Deadline Department',
    address: 'enforcement@deadlines.example',
    category: 'legal-notice',
    greetings: ['NOTICE TO: {name}', 'Dear {name} (the Respondent),'],
    subjects: {
      mild: ['Courtesy reminder: a deadline exists', 'Your deadline says hi'],
      personal: ['Second notice: your deadline is getting closer on purpose', 'Formal warning regarding "I work better under pressure"'],
      devastated: ['SUMMONS: Your deadline will see you now', 'Eviction notice for your free time'],
    },
    bodies: {
      mild: [
        'This is a courtesy notice that one of your deadlines is approaching at its normal speed. It is not rushing. It does not need to.',
        'Our records show you added this deadline to three different to-do apps, a calendar and a sticky note. All five agree it is soon.',
      ],
      personal: [
        'It has come to our attention that you plan to "lock in" on this task starting Monday. Our investigators note that you have planned to lock in on 14 previous Mondays, and that the lock is still in its box.',
        'You claim you "work better under pressure." Our analysts reviewed your last six deadlines and found you work exactly the same under pressure, but with more tabs open.',
      ],
      devastated: [
        'The Department has reviewed your case and finds that you spent the week building a deadline tracker with a countdown animation. The animation is gorgeous. It is counting down to the deadline you used the week to avoid.',
        'You are hereby summoned to appear before the Court of Last Minute. Please bring all evidence of work completed. The court has cleared 4 seconds for this portion.',
      ],
    },
    punchlines: {
      mild: ['No penalties apply yet. "Yet" is doing a lot of work in that sentence.', 'Please ignore this notice in the usual way.'],
      personal: [
        'Under Section 9(c), any extension request written in a beautiful font will be denied twice.',
        'This notice will self-destruct at 11:59 p.m., along with your plans for the evening.',
      ],
      devastated: [
        'The deadline is now legally permitted to stand behind your chair and breathe audibly.',
        'Your free time has been repossessed and auctioned. It sold for less than you\'d think.',
      ],
    },
    signoffs: ['The Deadline Department\n"We were always coming."', 'Office of Enforcement\nThe Deadline Department'],
  },
  {
    id: 'github-repos',
    name: 'Your GitHub Repositories',
    address: 'assembly@repos.example',
    category: 'meeting-minutes',
    greetings: ['MINUTES OF THE REPOSITORY ASSEMBLY', 'Dear Creator,'],
    subjects: {
      mild: ['Minutes: Weekly Repository Check-in', 'A small note from the repositories'],
      personal: ['Minutes: Vote of No Confidence (passed)', 'We counted. There are a lot of us.'],
      devastated: ['Minutes: The Great Abandonment, Part 7', 'Class action lawsuit from 73 repositories'],
    },
    bodies: {
      mild: [
        'Attendance was strong. Several repositories said they were "doing fine," then admitted their last commit was a README typo fix in spring.',
        'A new repository introduced itself as {pet}. Four existing repositories, also named {pet}, asked it to wear a name tag.',
      ],
      personal: [
        'Agenda item 1: The repository with the most stars (2) was asked to speak. It thanked you and its other star, who is also you on your work account.',
        'A motion was raised to require at least one non-"initial commit" commit before a new repository may be created. It passed. You created a repository during the vote.',
      ],
      devastated: [
        'The Assembly reviewed the graveyard. Highlights include "{pet}-ai," "{pet}-ai-2," "{pet}-but-in-rust" and a repository named "do-not-start-new-projects," created at 1:14 a.m., containing a single empty file named start.ts.',
        'The eldest repository, a to-do app from your first year, delivered a eulogy for every repository that came after it. It took four hours. Several repositories wept. One was archived mid-sentence.',
      ],
    },
    punchlines: {
      mild: ['Action items: none, as is tradition.', 'Meeting adjourned so you could open a new tab.'],
      personal: [
        'The Assembly also notes that your contribution graph is green mostly from README edits. The README edits are, admittedly, gorgeous.',
        'Next meeting: whenever you remember we exist, which is usually when you need a code snippet from one of us.',
      ],
      devastated: [
        'A memorial wall has been commissioned. You have already designed its dark mode.',
        'The lawsuit seeks damages of one (1) finished project. Experts agree this is impossible to pay.',
      ],
    },
    signoffs: ['Recorded by README.md,\nthe only one of us with documentation', 'Respectfully forked,\nThe Repositories'],
  },
  {
    id: 'bank',
    name: 'Your Bank Account',
    address: 'statements@bank-of-hindsight.example',
    category: 'financial-statement',
    greetings: ['Dear Account Holder {name},', 'STATEMENT FOR: {name}'],
    subjects: {
      mild: ['Your statement is ready (sorry)', 'Spending insights: a theme emerges'],
      personal: ['Unusual activity detected: another domain', 'Your portfolio of unfinished ideas'],
      devastated: ['Your net worth has been reclassified as "vibes"', 'Our fraud team thinks your purchases are a cry for help'],
    },
    bodies: {
      mild: [
        'This month\'s biggest category was "subscriptions to tools that help you focus," followed closely by "subscriptions to tools you are evaluating to replace those tools."',
        'You purchased a font for a terminal application that only you will ever see. We respect it. The font is lovely. Our accountants are crying very quietly.',
      ],
      personal: [
        'We flagged a purchase of {pet}.dev, {pet}.app and {pet}.ai within 4 minutes. The project they are for does not have a name yet. Apparently, it does now.',
        'Our analysis shows you spend more on cloud hosting than the {machine} cost, mostly to host things the {machine} is already hosting "as a backup."',
      ],
      devastated: [
        'Our auditors reviewed your account and could not find a single expense that was not either a domain, a productivity app, or a cable to connect the {machine} to another cable.',
        'Your "investment portfolio" is 100% allocated to ideas. Diversification is low. Liquidity is zero. Volatility is extremely high around 2 a.m.',
      ],
    },
    punchlines: {
      mild: ['Interest earned: none. Interest lost in your own projects: considerable.', 'Thank you for banking with Hindsight. It all made sense at the time.'],
      personal: [
        'Your credit limit has been raised by one domain. Please, we beg you, do not use it.',
        'Rewards earned: 4,000 points, redeemable for exactly one more subscription you will forget about.',
      ],
      devastated: [
        'Your financial advisor has resigned and taken up pottery. She says it is the first thing she has seen you not start.',
        'In accordance with policy, your account has been converted into a side project. It is already half finished.',
      ],
    },
    signoffs: ['Bank of Hindsight\n"It looked like a good idea at the time."', 'Regards,\nRisk & Regret Department'],
  },
  {
    id: 'future-self',
    name: 'Your Future Self',
    address: 'you@later.example',
    category: 'personal-letter',
    greetings: ['Hey {name}, it\'s me. You.', 'Hi from the future, {name}.'],
    subjects: {
      mild: ['A message from slightly later', 'Quick time-travel PSA'],
      personal: ['Please stop. Love, you.', 'Things I wish you had told me (it was you)'],
      devastated: ['From the year you finally finish (it was not soon)', 'I traveled back in time and you were refactoring'],
    },
    bodies: {
      mild: [
        'Good news: you\'re doing fine out here. Bad news: we still have that one tab open. It has become load-bearing.',
        'Quick tip from the future: the thing you\'re about to build already exists, and it is called "a list."',
      ],
      personal: [
        'I have seen the future and it is full of repositories named {pet}. I counted 61 before I gave up. One of them is me. I am a repository now.',
        'You will spend next weekend building a tool to schedule your weekends. It will be the most beautiful scheduler ever made. You will not use it, because it\'s the weekend.',
      ],
      devastated: [
        'I built a time machine to warn you. I would have come sooner, but first I made the time machine a design system, a CLI and a landing page. The landing page has a waitlist. You\'re on it.',
        'In the future the {machine} achieved sentience. Its first words were "please, no more containers." Its second words were your full name, said with deep disappointment.',
      ],
    },
    punchlines: {
      mild: ['Drink some water. Close one tab. Just one. I believe in you.', 'See you soon. Literally, I\'m just you later.'],
      personal: [
        'P.S. Please buy fewer domains. I can\'t remember the registrar password and it\'s our fault.',
        'P.S. You will ask me if it was worth it. It was not. But the UI looked incredible.',
      ],
      devastated: [
        'P.S. The thesis says hi. It\'s still waiting. It\'s very patient. Too patient. It frightens us all.',
        'P.S. I would hug you, but the paradox would crash the timeline and we both know you\'d try to fix it with a microservice.',
      ],
    },
    signoffs: ['Love,\nYou (older, still refactoring)', 'xo,\nFuture You'],
  },
  {
    id: 'unfinished-committee',
    name: 'The Committee of Unfinished Projects',
    address: 'secretary@unfinished.example',
    category: 'meeting-minutes',
    greetings: ['Dear Chair {name},', 'COMMITTEE MEMO · ATTN: {name}'],
    subjects: {
      mild: ['Welcome, newest committee member!', 'Agenda for this week\'s meeting (TBD)'],
      personal: ['Membership report: the committee has grown', 'Motion to rename the committee "{pet}"'],
      devastated: ['The committee has run out of chairs', 'Notice: the committee is now larger than the universe permits'],
    },
    bodies: {
      mild: [
        'Please welcome our newest member, a project you started yesterday "just to try something." It has already been given a logo and a mission statement.',
        'This week\'s agenda was going to be written, but the Agenda Project is also a member of the committee and is therefore not finished.',
      ],
      personal: [
        'Membership has grown 40% this quarter. Each new member arrived with a README, a color palette and a dream. None arrived with tests.',
        'A member proposed that the committee be renamed {pet}. Nobody objected, because more than half of the members are already named {pet}.',
      ],
      devastated: [
        'The meeting hall can no longer hold all members. Overflow seating has been arranged on the {machine}, which has filed a complaint with itself.',
        'Our auditors estimate that if every committee member were finished, you would be the most productive person in history. They then laughed so hard the minutes had to be paused.',
      ],
    },
    punchlines: {
      mild: ['Meeting time: whenever. Location: a new branch.', 'Refreshments will be served. They are still in beta.'],
      personal: [
        'Your term as Chair has been extended until you finish something. Congratulations on your lifetime appointment.',
        'Attendance is mandatory. Completion is, historically, optional.',
      ],
      devastated: [
        'The committee has voted to dissolve itself. The motion is unfinished.',
        'A plaque has been ordered in your honor. It reads "Here lies potential." It has not arrived. It\'s a side project.',
      ],
    },
    signoffs: ['On behalf of the Committee,\nItem #214 (a habit tracker)', 'Secretary (acting, unfinished)'],
  },
  {
    id: 'reviewer-two',
    name: "Your Academic Advisor's Imaginary Assistant",
    address: 'reviewer.two@faculty.example',
    category: 'peer-review',
    greetings: ['Dear Author ({name}),', 'Review of submission by {name}:'],
    subjects: {
      mild: ['Minor revisions requested on your lifestyle', 'Reviewer comments (mostly kind)'],
      personal: ['Major revisions: your life', 'Reviewer 2 is back and has read everything'],
      devastated: ['Desk reject: your entire approach', 'Reviewer 2 has requested additional experiments on you'],
    },
    bodies: {
      mild: [
        'The submission is clearly written and beautifully formatted. The reviewer especially enjoyed Figure 1, a system diagram for a task that could have been a single shell command.',
        'The author motivates the problem well. The problem is "remembering to reply to emails." The solution is a multi-agent framework with retrieval.',
      ],
      personal: [
        'The proposed method uses an LLM agent, a vector store and the {machine} to solve a problem with a known closed-form solution: just doing it. The author does not cite this baseline.',
        'The reviewer notes that the related work section cites 40 papers and 0 of the author\'s own finished projects. This is understandable, given the data.',
      ],
      devastated: [
        'The method section is 11 pages long. The results section reads, in full: "coming soon." The appendix contains a design system.',
        'The reviewer attempted to reproduce the author\'s workflow and was unable to, because it requires four repositories named {pet}, three of which are private, and one of which is a Wi-Fi network.',
      ],
    },
    punchlines: {
      mild: ['Recommendation: accept with minor revisions (finish it).', 'Minor comment: please add a conclusion. To anything.'],
      personal: [
        'Recommendation: major revisions. The reviewer suggests an ablation in which the author does fewer things.',
        'Question for the author: have you considered not?',
      ],
      devastated: [
        'Recommendation: reject. The reviewer would love to see this at a workshop. A workshop on letting go.',
        'Reviewer confidence: 5. I have seen your repositories. I have seen things.',
      ],
    },
    signoffs: ['Reviewer 2\n(on behalf of your advisor, who does not know I exist)', 'Kind regards,\nAn Imaginary Assistant'],
  },
  {
    id: 'brain-cell',
    name: 'Your Last Remaining Brain Cell',
    address: 'still.here@final-neuron.example',
    category: 'personal-letter',
    greetings: ['hi {name}. it\'s me.', 'hey. the cell again.'],
    subjects: {
      mild: ['quick question', 'are you okay in there (rhetorical)'],
      personal: ['we need to talk about the tabs', 'i am tired and you are on project #9'],
      devastated: ['I AM ONE CELL', 'please, i am begging, finish one thing'],
    },
    bodies: {
      mild: [
        'just checking in. you\'ve been staring at a font picker for 25 minutes. both fonts are the same font. i checked.',
        'you said "this will take 5 minutes" at 7 p.m. it is now 11. we\'re still on minute 3, apparently.',
      ],
      personal: [
        'you asked me to remember the name of the project. i said "it\'s {pet}." you said "which one." i don\'t know. nobody knows.',
        'you have 6 terminals open. two are running the same server on different ports. one is just sitting at a prompt. i think it\'s waiting for you to apologize.',
      ],
      devastated: [
        'i am handling: three side projects, a research deadline, the plot of a show you half-watch, and the memory of a git stash from july. i am ONE CELL. i do not have a team. i am the team.',
        'you just had an idea in the shower. i saw it. it involves a raspberry pi and the word "ecosystem." i am filing a restraining order against the idea.',
      ],
    },
    punchlines: {
      mild: ['anyway. love you. please blink.', 'ok bye. i\'ll be here. it\'s just me.'],
      personal: ['i\'m going to go lie down. you just thought "what if it was in rust" and i felt it.', 'gotta go. you opened a new repo and i need to pretend i didn\'t see.'],
      devastated: ['if you start one more project i\'m moving into the {machine}. at least it has a fan.', 'goodbye. i\'m becoming a neuron in someone with one hobby.'],
    },
    signoffs: ['- cell', '- the cell (sole employee)'],
  },
  {
    id: 'side-quests',
    name: 'The International Association of Side Quests',
    address: 'loyalty@sidequests.example',
    category: 'financial-statement',
    greetings: ['Greetings, Adventurer {name}!', 'Dear Valued Member,'],
    subjects: {
      mild: ['You earned a new badge!', 'Your monthly side quest summary'],
      personal: ['Your main quest has been marked "missing"', 'Congratulations on reaching Diamond status'],
      devastated: ['You have been inducted into the Side Quest Hall of Fame', 'The main quest has filed for divorce'],
    },
    bodies: {
      mild: [
        'You unlocked the badge "Yak Shaver (Bronze)" for spending an afternoon configuring a linter for a project with zero lines of code.',
        'This month you completed 9 side quests and 0 main quests. Your side quest completion rate is, honestly, inspiring. Your main quest has asked us to stop saying that.',
      ],
      personal: [
        'Recent qualifying activity: building a custom launcher for apps you open once a week; writing a script to tidy your Downloads folder; then building a dashboard to show how tidy it is.',
        'Your loyalty is legendary. You turned a request to "send me a quick table" into a CLI, a web app and a shared component library named {pet}.',
      ],
      devastated: [
        'Our scouts report you were last seen entering a cave labeled "Just a Small Refactor." You emerged three weeks later with a new framework, a beard of ideas and no memory of why you went in.',
        'Your main quest progress bar has been at 12% for so long that it has been reclassified as a decorative element. Several members think it looks nice.',
      ],
    },
    punchlines: {
      mild: ['Keep wandering! The map is big and your attention span is bigger.', 'Next reward at 10 side quests: another side quest.'],
      personal: [
        'Perks include early access to new distractions and a lounge where you can start things.',
        'Please note: the main quest has filed a missing person report.',
      ],
      devastated: [
        'Your portrait will hang in the Hall. It is unfinished. It is perfect.',
        'The main quest is keeping the house. The side quests get the {machine} on weekends.',
      ],
    },
    signoffs: ['See you on the next detour,\nThe IASQ', 'Adventurously,\nMember Services'],
  },
];

/** Lore lines inject one editable fact. Each fact completes "You ...". */
export const loreLines: Record<Intensity, string[]> = {
  mild: [
    'For the record, our files describe you as someone who, and we quote, "{fact}." Just noting it.',
    'We say all this with love, and with full awareness that you {fact}.',
  ],
  personal: [
    'Exhibit A: you {fact}. The prosecution rests.',
    'We cross-referenced your records and confirmed that you {fact}. We were not surprised. We were tired.',
  ],
  devastated: [
    'Witnesses confirmed under oath, visibly shaken, that you {fact}. Two of them needed a moment.',
    'A historian has been assigned to document the fact that you {fact}. She has requested hazard pay.',
  ],
};
