/**
 * Comeback rules for the reply engine. Matching is plain keyword search:
 * the first rule with a keyword found in the reply wins. This engine does
 * not understand your defense. It just recognizes some words in it.
 */
export interface ComebackRule {
  id: string;
  keywords: string[];
  responses: string[];
}

export const comebackRules: ComebackRule[] = [
  {
    id: 'finished',
    keywords: ['finish', 'finished', 'complete', 'completed', 'shipped', 'ship', 'launched', 'done', 'released'],
    responses: [
      'Congratulations. The committee has located one completed repository. A national holiday has been proposed.',
      'Bold claim. Please attach the repository link, the deploy URL and a sworn statement from the README.',
      'We checked. It is "done" in the sense that you stopped opening it.',
    ],
  },
  {
    id: 'pet',
    keywords: ['mochi'],
    responses: [
      'Which Mochi? Please specify using the full name, version number and approximate year of abandonment.',
      'Every Mochi has been notified of your reply. They are all very confused about which of them you meant.',
    ],
  },
  {
    id: 'machine',
    keywords: ['mac mini', 'server', 'docker', 'homelab', 'container', 'self-host', 'selfhost'],
    responses: [
      'Your server has read your defense and released a statement through its fan. The statement is a high-pitched whine.',
      'We forwarded your message to the machine. It replied "please, no more containers" and then rebooted out of spite.',
    ],
  },
  {
    id: 'research',
    keywords: ['research', 'thesis', 'paper', 'advisor', 'phd', 'lab', 'experiment', 'master'],
    responses: [
      'Reviewer 2 has read your defense and requests additional experiments. On you.',
      'Your thesis heard you mention it and has asked us to pass along that it is "fine." It is not fine. It is a heading in bold.',
    ],
  },
  {
    id: 'busy',
    keywords: ['busy', 'time', 'schedule', 'later', 'tomorrow', 'weekend'],
    responses: [
      'Noted. Your calendar has been consulted. It started laughing and cannot stop.',
      '"Tomorrow" has been added to your list of projects. It is currently 0% complete.',
    ],
  },
  {
    id: 'pretty',
    keywords: ['pretty', 'beautiful', 'design', 'aesthetic', 'ui', 'font', 'color', 'colour', 'gradient'],
    responses: [
      'The Pretty UI Enforcement Agency agrees it looks incredible. It also asks what it does. You have 30 seconds.',
      'Your defense has been rejected, but in a really gorgeous font.',
    ],
  },
  {
    id: 'productive',
    keywords: ['productive', 'productivity', 'focus', 'todo', 'to-do', 'organized', 'organised', 'notion', 'pomodoro'],
    responses: [
      'Productivity App #8 would like to welcome you. Productivity App #7 would like a word.',
      'Your defense was found productive and has been color-coded. It is now overdue.',
    ],
  },
  {
    id: 'github',
    keywords: ['github', 'repo', 'repository', 'commit', 'streak', 'git'],
    responses: [
      'The repositories have reviewed your claim and voted to remain abandoned, out of solidarity.',
      'Your contribution streak is impressive. 61% of it is README edits. They are very good README edits.',
    ],
  },
  {
    id: 'sleep',
    keywords: ['sleep', 'tired', 'night', 'late'],
    responses: [
      'We tried to forward this to your Sleep Schedule, but it resigned in March and is not taking calls.',
      'Your 2 a.m. self has read this and left a single comment: "trust me." We do not.',
    ],
  },
  {
    id: 'sorry',
    keywords: ['sorry', 'apologize', 'apologise', 'my bad', 'forgive'],
    responses: [
      'Apology received, logged and framed. It changes nothing, but it looks lovely on the wall.',
      'We accept your apology. The universe does not, but it is very large and busy.',
    ],
  },
  {
    id: 'mean',
    keywords: ['mean', 'rude', 'unfair', 'cruel', 'harsh', 'wrong', 'lies', 'lie', 'not true', 'false'],
    responses: [
      'Feedback received. Our tone has been adjusted from "devastating" to "devastating, with a small bow on it."',
      'You call it rude. We call it a performance review with extra enthusiasm.',
      'Our fact-checkers have reviewed your objection and rated it "technically emotional."',
    ],
  },
  {
    id: 'unsubscribe',
    keywords: ['unsubscribe', 'stop', 'leave me alone', 'go away', 'block'],
    responses: [
      'Replying "stop" does not unsubscribe you. It only confirms that you read every word.',
      'Your request to be left alone has been forwarded to everyone.',
    ],
  },
  {
    id: 'thanks',
    keywords: ['thank', 'thanks', 'lol', 'haha', 'love', 'funny', 'lmao'],
    responses: [
      'Enjoyment detected. This was not the goal, but we will take it.',
      'You are welcome. A fresh batch of criticism is already on its way, as a thank-you gift.',
    ],
  },
  {
    id: 'question',
    keywords: ['?'],
    responses: [
      'Great question. A ticket has been opened. Estimated response time: whenever you finish a side project.',
      'We have forwarded your question to the Department of Answers, which is, regrettably, one of your unfinished projects.',
    ],
  },
];

/** Classic defenses get classic answers. Keys are lowercase with punctuation removed. */
export const exactComebacks: Record<string, string> = {
  'at least i finish my projects':
    'Congratulations. The committee has located one completed repository. A national holiday has been proposed.',
  'this is fine': 'The Mac mini would like a word about what "fine" means.',
  'no': 'Bold. Concise. Ultimately ineffective.',
};

export const fallbackComebacks: string[] = [
  'Our automated defense parser read your message twice and found zero admissible evidence.',
  'Your reply was received by the Department of Not Reading Replies. They are thrilled for you.',
  'We scanned your defense for keywords. It contains words. Many of them. None of them was "finished."',
  'Defense noted and filed under "Things We Will Bring Up Later."',
  'The committee has reviewed your reply and moved to table it indefinitely, alongside your projects.',
];

export const emptyReplyComeback =
  'You sent an empty reply. Honestly, the strongest defense anyone has offered so far.';

export const unsubscribeErrors: string[] = [
  'Error 403: The universe has denied your request.',
  'Your request has been forwarded to absolutely nobody.',
  'Unsubscription unsuccessful. We have become emotionally attached.',
  'You cannot unsubscribe from consequences.',
  'Request received. As a thank-you, you have been subscribed to two additional newsletters.',
  'Error 418: The unsubscribe page is also one of your unfinished projects.',
  'This link expired four minutes before you were born.',
];
