/**
 * English UI string catalog — the ONLY place UI copy lives (SPEC: copilot
 * instructions). Components import from here; never hard-code visible text.
 */
export const en = {
  common: {
    skipToContent: 'Skip to main content',
    primaryNavLabel: 'Primary',
    footerNavLabel: 'Footer',
    loading: 'Loading…',
    draftBadge: 'DRAFT',
  },

  nav: {
    home: 'Home',
    tests: 'Tests',
    dashboard: 'Dashboard',
    planner: 'Planner',
    settings: 'Settings',
  },

  footer: {
    licenceNotice: 'Code licensed under AGPL-3.0. Practice content licensed under CC BY-SA 4.0.',
    supportHeading: 'Support this project',
    koFi: 'Ko-fi',
    githubSponsors: 'GitHub Sponsors',
    resourcesHeading: 'Resources',
    legalHeading: 'Legal',
  },

  pages: {
    home: {
      title: 'IELTS Launchpad — Free IELTS Academic Mock Tests with AI Feedback',
      description:
        'Free, open-source IELTS Academic practice: exam-faithful Listening and Reading with instant grading, plus AI feedback for Writing and Speaking. No accounts, no tracking.',
      heading: 'Practice IELTS Academic for free',
      intro:
        'Exam-faithful Listening and Reading with deterministic grading, plus AI feedback for Writing and Speaking. Your data stays in your browser.',
    },
    tests: {
      title: 'Tests — IELTS Launchpad',
      description: 'Browse full mock tests and skill practice sets.',
      heading: 'Tests',
      intro: 'Full mock tests and practice sets will be listed here.',
    },
    dashboard: {
      title: 'Dashboard — IELTS Launchpad',
      description: 'Your band history, accuracy by question type, and weaknesses.',
      heading: 'Dashboard',
      intro: 'Band history and analytics will appear here once you complete a test.',
    },
    planner: {
      title: 'Study planner — IELTS Launchpad',
      description: 'A deterministic weekly study plan based on your target and available time.',
      heading: 'Study planner',
      intro: 'A weekly study plan will be generated from your target band and schedule.',
    },
    settings: {
      title: 'Settings — IELTS Launchpad',
      description: 'Font size, your own API key, and export, import or delete your data.',
      heading: 'Settings',
      intro: 'Manage font size, your own API key, and your locally stored data.',
    },
    officialResources: {
      title: 'Official resources — IELTS Launchpad',
      description: 'Links to official IELTS information and preparation materials.',
      heading: 'Official resources',
      intro: 'Curated links to official IELTS information will be listed here.',
    },
    howScoringWorks: {
      title: 'How scoring works — IELTS Launchpad',
      description: 'How Listening and Reading are graded and how band scores are estimated.',
      heading: 'How scoring works',
      intro: 'An explanation of grading rules and band estimation will go here.',
    },
    about: {
      title: 'About — IELTS Launchpad',
      description: 'About IELTS Launchpad, including AI-generated content and audio notices.',
      heading: 'About',
      intro: 'IELTS Launchpad is a free, open-source IELTS Academic practice project.',
      aiContentNotice:
        'Some practice content is AI-generated and reviewed by humans; it may contain mistakes.',
      aiAudioNotice: 'Some listening audio is AI-generated (synthetic voices).',
    },
    privacy: {
      title: 'Privacy — IELTS Launchpad',
      description: 'We set no cookies and run no analytics. Your data stays in your browser.',
      heading: 'Privacy',
      intro:
        'We do not use accounts, cookies, analytics or tracking. All your data stays in your browser.',
    },
    terms: {
      title: 'Terms — IELTS Launchpad',
      description: 'Terms of use for IELTS Launchpad.',
      heading: 'Terms',
      intro: 'Terms of use will be described here.',
    },
    licences: {
      title: 'Licences & credits — IELTS Launchpad',
      description: 'Open-source licences and credits for IELTS Launchpad.',
      heading: 'Licences & credits',
      intro: 'Licence information and third-party credits will be listed here.',
    },
    support: {
      title: 'Support — IELTS Launchpad',
      description: 'Support the project via Ko-fi or GitHub Sponsors.',
      heading: 'Support',
      intro: 'If this project helps you, you can support its development.',
    },
    notFound: {
      title: 'Page not found — IELTS Launchpad',
      description: 'The page you are looking for does not exist.',
      heading: 'Page not found',
      intro: 'The page you are looking for does not exist.',
      homeLink: 'Go to the home page',
    },
  },

  runner: {
    reading: {
      title: 'Reading — IELTS Launchpad',
      description: 'Practice an IELTS Academic Reading passage with instant grading.',
      loading: 'Loading the reading runner…',
      passageTab: 'Passage',
      questionsTab: 'Questions',
      passageHeading: 'Reading passage',
      questionsHeading: 'Questions',
      draftNotice: 'Draft content — for preview only.',
    },
    toolbar: {
      modeExam: 'Exam mode',
      modePractice: 'Practice mode',
      fontSizeLabel: 'Font size',
      fontDecrease: 'Decrease font size',
      fontIncrease: 'Increase font size',
      submit: 'Submit answers',
      submitConfirm: 'Submit your answers? You cannot change them afterwards.',
      submitted: 'Answers submitted',
    },
    timer: {
      label: 'Time remaining',
      warningTen: '10 minutes remaining.',
      warningFive: '5 minutes remaining.',
      expired: "Time is up — your answers have been submitted.",
    },
    navigator: {
      heading: 'Question navigator',
      answered: 'answered',
      flagged: 'flagged',
      goToQuestion: 'Go to question {n}',
      status: 'Question {n}: {state}',
      stateAnswered: 'answered',
      stateFlagged: 'flagged',
      stateAnsweredFlagged: 'answered and flagged',
      stateUnanswered: 'not answered',
    },
    question: {
      flag: 'Flag for review',
      unflag: 'Remove flag',
      flagged: 'Flagged for review',
      checkAnswer: 'Check answer',
      correct: 'Correct',
      incorrect: 'Incorrect',
      blankSelect: '— choose —',
      wordsRemaining: '{n} word(s) allowed',
      overLimit: 'Too many words — the limit is {n}.',
      chooseN: 'Choose {n}.',
      chooseNLimit: 'You can select only {n} options. Deselect one to choose another.',
    },
    dragBank: {
      bankHeading: 'Word bank',
      bankItem: 'Bank option {letter}: {word}',
      slotLabel: 'Gap {n}',
      place: 'Place selected option',
      pickUp: 'Pick up option {letter}',
      filledSlot: 'Gap {n}: {word}. Activate to remove.',
      emptySlot: 'Gap {n}: empty. Select a bank option, then activate this gap.',
      selectFirst: 'Select a word-bank option first.',
      returned: 'Option returned to the bank.',
    },
    passage: {
      highlight: 'Highlight selection',
      removeHighlight: 'Remove highlight',
      addNote: 'Add note',
      noteLabel: 'Note for highlighted text',
      saveNote: 'Save note',
      selectPrompt: 'Select text in the passage, then choose Highlight.',
    },
    result: {
      heading: 'Your reading result',
      score: 'You scored {raw} out of {max}.',
      close: 'Back to answers',
    },
  },
} as const;

export type Messages = typeof en;

