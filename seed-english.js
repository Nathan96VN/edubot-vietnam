// seed-english.js
// Cambridge Primary English as a Second Language 0057 Curriculum Framework
// Stages 1–6 — all learning objectives across 5 strands
// Run once: change Render build command to `npm install && node seed-english.js`, deploy, then revert.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const objectives = [

  // ─────────────────────────────────────────────
  // STAGE 1
  // ─────────────────────────────────────────────

  // Listening — Listening for global meaning
  { stage: 1, strand: 'Listening', substrand: 'Listening for global meaning', code: '1Lm.01', objective: 'Understand, with support, the main point of short talk.' },

  // Listening — Listening for detail
  { stage: 1, strand: 'Listening', substrand: 'Listening for detail', code: '1Ld.01', objective: 'Recognise a limited range of simple words that are spelled out slowly and clearly.' },
  { stage: 1, strand: 'Listening', substrand: 'Listening for detail', code: '1Ld.02', objective: 'Understand, with support, a limited range of short, simple instructions.' },
  { stage: 1, strand: 'Listening', substrand: 'Listening for detail', code: '1Ld.03', objective: 'Understand, with support, a limited range of short, simple questions which ask for simple information.' },
  { stage: 1, strand: 'Listening', substrand: 'Listening for detail', code: '1Ld.04', objective: 'Deduce meaning from context, with support, of a limited range of simple words.' },
  { stage: 1, strand: 'Listening', substrand: 'Listening for detail', code: '1Ld.05', objective: 'Understand, with support, some specific information and detail of short talk.' },

  // Speaking — Communication
  { stage: 1, strand: 'Speaking', substrand: 'Communication', code: '1Sc.01', objective: 'Give basic information about themselves using simple words and phrases.' },
  { stage: 1, strand: 'Speaking', substrand: 'Communication', code: '1Sc.02', objective: 'Describe people, places and objects, and routine actions and events, using simple words and phrases.' },
  { stage: 1, strand: 'Speaking', substrand: 'Communication', code: '1Sc.03', objective: 'Ask simple questions about classroom routines and to find out a limited range of personal information and respond accordingly.' },
  { stage: 1, strand: 'Speaking', substrand: 'Communication', code: '1Sc.04', objective: 'Reproduce correctly a limited range of sounds in simple, familiar words and phrases.' },
  { stage: 1, strand: 'Speaking', substrand: 'Communication', code: '1Sc.05', objective: 'Produce short, isolated, rehearsed phrases using gesture and signalled requests for help when necessary.' },
  { stage: 1, strand: 'Speaking', substrand: 'Communication', code: '1Sc.06', objective: 'Use a limited range of simple grammatical structures, allowing for frequent, basic mistakes.' },

  // Speaking — Organisation
  { stage: 1, strand: 'Speaking', substrand: 'Organisation', code: '1Sor.01', objective: 'Link, with support, words and phrases using basic connectives.' },
  { stage: 1, strand: 'Speaking', substrand: 'Organisation', code: '1Sor.02', objective: 'Take turns when speaking with others in a limited range of short, basic exchanges.' },

  // Writing — Communicative achievement
  { stage: 1, strand: 'Writing', substrand: 'Communicative achievement', code: '1Wca.01', objective: 'Write letters and words in a straight line from left to right.' },
  { stage: 1, strand: 'Writing', substrand: 'Communicative achievement', code: '1Wca.02', objective: 'Form upper and lower case letters.' },
  { stage: 1, strand: 'Writing', substrand: 'Communicative achievement', code: '1Wca.03', objective: 'Spell some simple, high-frequency words accurately during guided writing activities.' },
  { stage: 1, strand: 'Writing', substrand: 'Communicative achievement', code: '1Wca.04', objective: 'Write familiar words.' },
  { stage: 1, strand: 'Writing', substrand: 'Communicative achievement', code: '1Wca.05', objective: 'Begin to use a limited range of simple grammatical structures, allowing for frequent, basic mistakes.' },

  // Writing — Content
  { stage: 1, strand: 'Writing', substrand: 'Content', code: '1Wc.01', objective: 'Write, with support, words and short, simple phrases to give personal and factual information.' },

  // Reading — Reading for detail
  { stage: 1, strand: 'Reading', substrand: 'Reading for detail', code: '1Rd.01', objective: 'Recognise, identify, sound and name the letters of the alphabet.' },
  { stage: 1, strand: 'Reading', substrand: 'Reading for detail', code: '1Rd.02', objective: 'Recognise, identify and blend sounds in individual words.' },
  { stage: 1, strand: 'Reading', substrand: 'Reading for detail', code: '1Rd.03', objective: 'Understand, with support, simple words and phrases in short, simple, illustrated texts.' },
  { stage: 1, strand: 'Reading', substrand: 'Reading for detail', code: '1Rd.04', objective: 'Begin to deduce the meaning of a limited range of simple, familiar words, with support, by linking them to pictures.' },

  // Use of English — Grammatical forms
  { stage: 1, strand: 'Use of English', substrand: 'Grammatical forms', code: '1Ug.01', objective: 'Use familiar question words and structures.' },
  { stage: 1, strand: 'Use of English', substrand: 'Grammatical forms', code: '1Ug.02', objective: 'Use common present simple forms to give basic personal and factual information.' },
  { stage: 1, strand: 'Use of English', substrand: 'Grammatical forms', code: '1Ug.03', objective: 'Use common present continuous forms [positive, negative, question] to talk about present activities.' },
  { stage: 1, strand: 'Use of English', substrand: 'Grammatical forms', code: '1Ug.04', objective: 'Use can/can\'t to describe ability.' },
  { stage: 1, strand: 'Use of English', substrand: 'Grammatical forms', code: '1Ug.05', objective: 'Use common adjectives, including colours, to say what someone/something is or has.' },
  { stage: 1, strand: 'Use of English', substrand: 'Grammatical forms', code: '1Ug.06', objective: 'Use possessive adjectives to describe objects.' },

  // Use of English — Vocabulary
  { stage: 1, strand: 'Use of English', substrand: 'Vocabulary', code: '1Uv.01', objective: 'Use cardinal numbers 1–20.' },
  { stage: 1, strand: 'Use of English', substrand: 'Vocabulary', code: '1Uv.02', objective: 'Use ordinal numbers 1st–10th.' },
  { stage: 1, strand: 'Use of English', substrand: 'Vocabulary', code: '1Uv.03', objective: 'Use with to indicate accompaniment and for to indicate recipient.' },
  { stage: 1, strand: 'Use of English', substrand: 'Vocabulary', code: '1Uv.04', objective: 'Use basic prepositions of location and position (e.g. at, in, near, next to, on) to describe where people and things are.' },
  { stage: 1, strand: 'Use of English', substrand: 'Vocabulary', code: '1Uv.05', objective: 'Use prepositions of time (e.g. on, in) to talk about days and time.' },
  { stage: 1, strand: 'Use of English', substrand: 'Vocabulary', code: '1Uv.06', objective: 'Use common adverbs of place (e.g. here, there) to indicate where things are.' },
  { stage: 1, strand: 'Use of English', substrand: 'Vocabulary', code: '1Uv.07', objective: 'Use common singular nouns, plural nouns [plural \'s\'] and proper nouns to say what things are.' },

  // Use of English — Sentence structure
  { stage: 1, strand: 'Use of English', substrand: 'Sentence structure', code: '1Us.01', objective: 'Use articles a, the to refer to familiar objects.' },
  { stage: 1, strand: 'Use of English', substrand: 'Sentence structure', code: '1Us.02', objective: 'Use demonstrative pronouns this, these to indicate things.' },
  { stage: 1, strand: 'Use of English', substrand: 'Sentence structure', code: '1Us.03', objective: 'Use common personal subject and object pronouns to give simple personal information.' },
  { stage: 1, strand: 'Use of English', substrand: 'Sentence structure', code: '1Us.04', objective: 'Use connective and to link words and phrases.' },
  { stage: 1, strand: 'Use of English', substrand: 'Sentence structure', code: '1Us.05', objective: 'Use like + verb + ing to express likes and dislikes.' },

  // ─────────────────────────────────────────────
  // STAGE 2
  // ─────────────────────────────────────────────

  // Listening — Listening for global meaning
  { stage: 2, strand: 'Listening', substrand: 'Listening for global meaning', code: '2Lm.01', objective: 'Understand, with little or no support, the main point of short talk.' },

  // Listening — Listening for detail
  { stage: 2, strand: 'Listening', substrand: 'Listening for detail', code: '2Ld.01', objective: 'Understand, with little or no support, a short sequence of familiar instructions.' },
  { stage: 2, strand: 'Listening', substrand: 'Listening for detail', code: '2Ld.02', objective: 'Understand, with support, a limited range of short questions which ask for simple information.' },
  { stage: 2, strand: 'Listening', substrand: 'Listening for detail', code: '2Ld.03', objective: 'Deduce meaning from context, with support, of an increasing range of simple words.' },
  { stage: 2, strand: 'Listening', substrand: 'Listening for detail', code: '2Ld.04', objective: 'Understand, with little or no support, some specific information and detail of short talk.' },

  // Speaking — Communication
  { stage: 2, strand: 'Speaking', substrand: 'Communication', code: '2Sc.01', objective: 'Give basic information about themselves using phrases and short sentences.' },
  { stage: 2, strand: 'Speaking', substrand: 'Communication', code: '2Sc.02', objective: 'Describe people, places and objects, and routine actions and events, using phrases and short sentences.' },
  { stage: 2, strand: 'Speaking', substrand: 'Communication', code: '2Sc.03', objective: 'Ask questions to find out an increasing range of personal information and respond accordingly.' },
  { stage: 2, strand: 'Speaking', substrand: 'Communication', code: '2Sc.04', objective: 'Pronounce familiar words and phrases so that these can be understood by others with some effort.' },
  { stage: 2, strand: 'Speaking', substrand: 'Communication', code: '2Sc.05', objective: 'Produce simple phrases, pausing to search for expressions and to repair communication.' },
  { stage: 2, strand: 'Speaking', substrand: 'Communication', code: '2Sc.06', objective: 'Use some simple grammatical structures, allowing for frequent, basic mistakes.' },

  // Speaking — Express opinion
  { stage: 2, strand: 'Speaking', substrand: 'Express opinion', code: '2So.01', objective: 'Express, with support, basic feelings.' },

  // Speaking — Organisation
  { stage: 2, strand: 'Speaking', substrand: 'Organisation', code: '2Sor.01', objective: 'Link, with little or no support, words and phrases using basic connectives.' },
  { stage: 2, strand: 'Speaking', substrand: 'Organisation', code: '2Sor.02', objective: 'Take turns when speaking with others in an increasing range of short, basic exchanges.' },

  // Writing — Communicative achievement
  { stage: 2, strand: 'Writing', substrand: 'Communicative achievement', code: '2Wca.01', objective: 'Write letters and words of consistent size and spacing.' },
  { stage: 2, strand: 'Writing', substrand: 'Communicative achievement', code: '2Wca.02', objective: 'Use upper and lower case letters accurately when writing names, places and short sentences during guided writing activities.' },
  { stage: 2, strand: 'Writing', substrand: 'Communicative achievement', code: '2Wca.03', objective: 'Spell an increasing number of simple, high-frequency words accurately during guided writing activities.' },
  { stage: 2, strand: 'Writing', substrand: 'Communicative achievement', code: '2Wca.04', objective: 'Plan and write phrases and short sentences, with support.' },
  { stage: 2, strand: 'Writing', substrand: 'Communicative achievement', code: '2Wca.05', objective: 'Use some simple grammatical structures, allowing for frequent, basic mistakes.' },

  // Writing — Organisation
  { stage: 2, strand: 'Writing', substrand: 'Organisation', code: '2Wor.01', objective: 'Use basic punctuation (e.g. full stop and question mark) during guided writing of short sentences and questions.' },
  { stage: 2, strand: 'Writing', substrand: 'Organisation', code: '2Wor.02', objective: 'Link, with support, words, phrases and short sentences using basic connectives.' },

  // Writing — Content
  { stage: 2, strand: 'Writing', substrand: 'Content', code: '2Wc.01', objective: 'Write, with support, simple phrases to give personal and factual information.' },
  { stage: 2, strand: 'Writing', substrand: 'Content', code: '2Wc.02', objective: 'Express, with support, basic feelings.' },

  // Reading — Reading for global meaning
  { stage: 2, strand: 'Reading', substrand: 'Reading for global meaning', code: '2Rm.01', objective: 'Understand, with support, the main point of short, simple texts.' },
  { stage: 2, strand: 'Reading', substrand: 'Reading for global meaning', code: '2Rm.02', objective: 'Begin to read, with support, short, simple fiction and non-fiction texts with confidence and enjoyment.' },

  // Reading — Reading for detail
  { stage: 2, strand: 'Reading', substrand: 'Reading for detail', code: '2Rd.01', objective: 'Recognise, identify and sound, with support, a limited range of words and phrases in short, simple texts.' },
  { stage: 2, strand: 'Reading', substrand: 'Reading for detail', code: '2Rd.02', objective: 'Understand, with support, some specific information and detail in short, simple, illustrated texts.' },
  { stage: 2, strand: 'Reading', substrand: 'Reading for detail', code: '2Rd.03', objective: 'Read and follow, with support, a limited range of short, familiar instructions.' },
  { stage: 2, strand: 'Reading', substrand: 'Reading for detail', code: '2Rd.04', objective: 'Deduce the meaning of an increasing range of simple, familiar words, with support, by linking them to pictures.' },

  // Use of English — Grammatical forms
  { stage: 2, strand: 'Use of English', substrand: 'Grammatical forms', code: '2Ug.01', objective: 'Use question words and structures to ask basic questions.' },
  { stage: 2, strand: 'Use of English', substrand: 'Grammatical forms', code: '2Ug.02', objective: 'Use common present simple forms, including short answer forms and contractions, to give personal and factual information.' },
  { stage: 2, strand: 'Use of English', substrand: 'Grammatical forms', code: '2Ug.03', objective: 'Use common past simple forms [regular and irregular] to describe actions and narrate simple events, including short answer forms and contractions.' },
  { stage: 2, strand: 'Use of English', substrand: 'Grammatical forms', code: '2Ug.04', objective: 'Use common present continuous forms, including short answers and contractions, to talk about present activities.' },
  { stage: 2, strand: 'Use of English', substrand: 'Grammatical forms', code: '2Ug.05', objective: 'Use future simple form will to talk about future intention.' },
  { stage: 2, strand: 'Use of English', substrand: 'Grammatical forms', code: '2Ug.06', objective: 'Use can to make requests and ask permission and use appropriate responses (e.g. here you are, OK).' },
  { stage: 2, strand: 'Use of English', substrand: 'Grammatical forms', code: '2Ug.07', objective: 'Use common adjectives on personal and familiar topics to give personal information and describe things.' },
  { stage: 2, strand: 'Use of English', substrand: 'Grammatical forms', code: '2Ug.08', objective: 'Use possessive adjectives to give personal information and describe familiar things.' },

  // Use of English — Vocabulary
  { stage: 2, strand: 'Use of English', substrand: 'Vocabulary', code: '2Uv.01', objective: 'Use cardinal numbers 1–100.' },
  { stage: 2, strand: 'Use of English', substrand: 'Vocabulary', code: '2Uv.02', objective: 'Use ordinal numbers 1st–50th.' },
  { stage: 2, strand: 'Use of English', substrand: 'Vocabulary', code: '2Uv.03', objective: 'Use with to indicate accompaniment and instrument and for to indicate recipient.' },
  { stage: 2, strand: 'Use of English', substrand: 'Vocabulary', code: '2Uv.04', objective: 'Use prepositions of location, position and direction (e.g. behind, between, in, in front of, to).' },
  { stage: 2, strand: 'Use of English', substrand: 'Vocabulary', code: '2Uv.05', objective: 'Use prepositions of time (e.g. at) to talk about days and time.' },
  { stage: 2, strand: 'Use of English', substrand: 'Vocabulary', code: '2Uv.06', objective: 'Use adverbs of definite time (e.g. now, today, yesterday, last week).' },
  { stage: 2, strand: 'Use of English', substrand: 'Vocabulary', code: '2Uv.07', objective: 'Use common -ly adverbs to describe actions.' },
  { stage: 2, strand: 'Use of English', substrand: 'Vocabulary', code: '2Uv.08', objective: 'Use the adverb too to add information.' },
  { stage: 2, strand: 'Use of English', substrand: 'Vocabulary', code: '2Uv.09', objective: 'Use countable and some common uncountable nouns, including some common irregular plural forms, and possessive \'s to name and label things.' },
  { stage: 2, strand: 'Use of English', substrand: 'Vocabulary', code: '2Uv.10', objective: 'Use there is/are to make short statements and descriptions.' },
  { stage: 2, strand: 'Use of English', substrand: 'Vocabulary', code: '2Uv.11', objective: 'Use impersonal you in questions (e.g. How do you spell that?).' },

  // Use of English — Sentence structure
  { stage: 2, strand: 'Use of English', substrand: 'Sentence structure', code: '2Us.01', objective: 'Use demonstratives this, that, these, those to refer to familiar objects.' },
  { stage: 2, strand: 'Use of English', substrand: 'Sentence structure', code: '2Us.02', objective: 'Use demonstrative pronouns this, these, that, those and object pronoun one in short statements and responses.' },
  { stage: 2, strand: 'Use of English', substrand: 'Sentence structure', code: '2Us.03', objective: 'Use common personal subject and object pronouns, including possessive pronouns (e.g. mine, yours), to give simple personal information and describe things.' },
  { stage: 2, strand: 'Use of English', substrand: 'Sentence structure', code: '2Us.04', objective: 'Use connectives (e.g. but, or, then) to link words and phrases.' },

  // ─────────────────────────────────────────────
  // STAGE 3
  // ─────────────────────────────────────────────

  // Listening — Listening for global meaning
  { stage: 3, strand: 'Listening', substrand: 'Listening for global meaning', code: '3Lm.01', objective: 'Understand, with support, some of the main points of short talk.' },

  // Listening — Listening for detail
  { stage: 3, strand: 'Listening', substrand: 'Listening for detail', code: '3Ld.01', objective: 'Understand a limited range of familiar instructions.' },
  { stage: 3, strand: 'Listening', substrand: 'Listening for detail', code: '3Ld.02', objective: 'Understand, with little or no support, a limited range of questions which ask for information.' },
  { stage: 3, strand: 'Listening', substrand: 'Listening for detail', code: '3Ld.03', objective: 'Deduce meaning from context, with support, in short talk.' },
  { stage: 3, strand: 'Listening', substrand: 'Listening for detail', code: '3Ld.04', objective: 'Understand, with support, most specific information and detail of short talk.' },

  // Listening — Listening for opinion
  { stage: 3, strand: 'Listening', substrand: 'Listening for opinion', code: '3Lo.01', objective: 'Recognise, with support, the opinions of the speaker(s) in short talk.' },

  // Speaking — Communication
  { stage: 3, strand: 'Speaking', substrand: 'Communication', code: '3Sc.01', objective: 'Give basic information about themselves using sentences.' },
  { stage: 3, strand: 'Speaking', substrand: 'Communication', code: '3Sc.02', objective: 'Describe people, places and objects, and routine actions and events, using sentences.' },
  { stage: 3, strand: 'Speaking', substrand: 'Communication', code: '3Sc.03', objective: 'Ask questions to find out general information on a limited range of topics and respond accordingly.' },
  { stage: 3, strand: 'Speaking', substrand: 'Communication', code: '3Sc.04', objective: 'Give, with support, short, simple instructions.' },
  { stage: 3, strand: 'Speaking', substrand: 'Communication', code: '3Sc.05', objective: 'Pronounce familiar words and phrases so that these can generally be understood by others.' },
  { stage: 3, strand: 'Speaking', substrand: 'Communication', code: '3Sc.06', objective: 'Produce sentences to maintain short exchanges, allowing for noticeable hesitation and false starts.' },
  { stage: 3, strand: 'Speaking', substrand: 'Communication', code: '3Sc.07', objective: 'Use some simple grammatical structures and sentence patterns correctly, allowing for frequent, basic mistakes.' },

  // Speaking — Express opinion
  { stage: 3, strand: 'Speaking', substrand: 'Express opinion', code: '3So.01', objective: 'Express, with support, basic opinions and feelings.' },

  // Speaking — Organisation
  { stage: 3, strand: 'Speaking', substrand: 'Organisation', code: '3Sor.01', objective: 'Link words and phrases using basic connectives.' },
  { stage: 3, strand: 'Speaking', substrand: 'Organisation', code: '3Sor.02', objective: 'Initiate and maintain interaction, with support, in a limited range of short exchanges.' },

  // Writing — Communicative achievement
  { stage: 3, strand: 'Writing', substrand: 'Communicative achievement', code: '3Wca.01', objective: 'Use legible handwriting in written work.' },
  { stage: 3, strand: 'Writing', substrand: 'Communicative achievement', code: '3Wca.02', objective: 'Use upper and lower case letters accurately when writing names, places and short sentences when writing independently.' },
  { stage: 3, strand: 'Writing', substrand: 'Communicative achievement', code: '3Wca.03', objective: 'Spell most simple, high-frequency words accurately during guided writing activities.' },
  { stage: 3, strand: 'Writing', substrand: 'Communicative achievement', code: '3Wca.04', objective: 'Plan, write and check sentences, with support.' },
  { stage: 3, strand: 'Writing', substrand: 'Communicative achievement', code: '3Wca.05', objective: 'Use some simple grammatical structures and sentence patterns correctly, allowing for frequent, basic mistakes.' },

  // Writing — Organisation
  { stage: 3, strand: 'Writing', substrand: 'Organisation', code: '3Wor.01', objective: 'Use basic punctuation (e.g. exclamation mark) with some accuracy during guided writing of sentences.' },
  { stage: 3, strand: 'Writing', substrand: 'Organisation', code: '3Wor.02', objective: 'Link, with little or no support, words, phrases and short sentences using basic connectives.' },

  // Writing — Content
  { stage: 3, strand: 'Writing', substrand: 'Content', code: '3Wc.01', objective: 'Write, with support, short, simple instructions.' },
  { stage: 3, strand: 'Writing', substrand: 'Content', code: '3Wc.02', objective: 'Write, with support, short sentences which describe people, places and objects, and routine actions and events.' },
  { stage: 3, strand: 'Writing', substrand: 'Content', code: '3Wc.03', objective: 'Express, with support, basic opinions and feelings.' },

  // Reading — Reading for global meaning
  { stage: 3, strand: 'Reading', substrand: 'Reading for global meaning', code: '3Rm.01', objective: 'Understand, with little or no support, the main point of short, simple texts.' },
  { stage: 3, strand: 'Reading', substrand: 'Reading for global meaning', code: '3Rm.02', objective: 'Read, with support, a limited range of short, simple fiction and non-fiction texts with confidence and enjoyment.' },

  // Reading — Reading for detail
  { stage: 3, strand: 'Reading', substrand: 'Reading for detail', code: '3Rd.01', objective: 'Understand, with support, most specific information and detail in short, simple texts.' },
  { stage: 3, strand: 'Reading', substrand: 'Reading for detail', code: '3Rd.02', objective: 'Read and follow a short sequence of familiar instructions.' },
  { stage: 3, strand: 'Reading', substrand: 'Reading for detail', code: '3Rd.03', objective: 'Deduce meaning from context, with support, in short, simple, illustrated texts.' },

  // Reading — Reading for opinion
  { stage: 3, strand: 'Reading', substrand: 'Reading for opinion', code: '3Ro.01', objective: 'Recognise, with support, the opinions of the writer(s) in short, simple texts.' },

  // Use of English — Grammatical forms
  { stage: 3, strand: 'Use of English', substrand: 'Grammatical forms', code: '3Ug.01', objective: 'Use question words and structures to ask questions.' },
  { stage: 3, strand: 'Use of English', substrand: 'Grammatical forms', code: '3Ug.02', objective: 'Use imperative forms [positive only] of common verbs for simple commands and instructions.' },
  { stage: 3, strand: 'Use of English', substrand: 'Grammatical forms', code: '3Ug.03', objective: 'Use present simple forms to describe a limited range of routines, habits and states.' },
  { stage: 3, strand: 'Use of English', substrand: 'Grammatical forms', code: '3Ug.04', objective: 'Use past simple regular and irregular forms to describe actions and narrate simple events.' },
  { stage: 3, strand: 'Use of English', substrand: 'Grammatical forms', code: '3Ug.05', objective: 'Use present continuous forms to describe events and talk about present activities.' },
  { stage: 3, strand: 'Use of English', substrand: 'Grammatical forms', code: '3Ug.06', objective: 'Begin to use present perfect forms [regular and irregular] of common verbs (e.g. have you [ever] been?) to talk about experiences.' },
  { stage: 3, strand: 'Use of English', substrand: 'Grammatical forms', code: '3Ug.07', objective: 'Use shall [interrogative] to make suggestions and will to ask about future intention.' },
  { stage: 3, strand: 'Use of English', substrand: 'Grammatical forms', code: '3Ug.08', objective: 'Use must to express obligation and could as a past form of can.' },
  { stage: 3, strand: 'Use of English', substrand: 'Grammatical forms', code: '3Ug.09', objective: 'Use common adjectives and comparative and superlative adjectives to give personal information and opinions and describe things.' },

  // Use of English — Vocabulary
  { stage: 3, strand: 'Use of English', substrand: 'Vocabulary', code: '3Uv.01', objective: 'Use cardinal numbers 1–1000.' },
  { stage: 3, strand: 'Use of English', substrand: 'Vocabulary', code: '3Uv.02', objective: 'Use by and with to indicate agent and instrument and from [origin] and with/without [inclusion].' },
  { stage: 3, strand: 'Use of English', substrand: 'Vocabulary', code: '3Uv.03', objective: 'Use prepositions of location, position and direction (e.g. above, below, inside, opposite, outside, under).' },
  { stage: 3, strand: 'Use of English', substrand: 'Vocabulary', code: '3Uv.04', objective: 'Use prepositions of time (e.g. after, before) to state when things happen.' },
  { stage: 3, strand: 'Use of English', substrand: 'Vocabulary', code: '3Uv.05', objective: 'Use a range of adverbs of definite time.' },
  { stage: 3, strand: 'Use of English', substrand: 'Vocabulary', code: '3Uv.06', objective: 'Use common adverbs of frequency (e.g. never, a lot).' },
  { stage: 3, strand: 'Use of English', substrand: 'Vocabulary', code: '3Uv.07', objective: 'Use common adverbs of sequence (e.g. first, next, then) and direction (e.g. left, right).' },
  { stage: 3, strand: 'Use of English', substrand: 'Vocabulary', code: '3Uv.08', objective: 'Use adverbs of manner (e.g. slowly, quietly).' },
  { stage: 3, strand: 'Use of English', substrand: 'Vocabulary', code: '3Uv.09', objective: 'Use countable nouns as direct and indirect objects.' },

  // Use of English — Sentence structure
  { stage: 3, strand: 'Use of English', substrand: 'Sentence structure', code: '3Us.01', objective: 'Use a limited range of quantifiers (e.g. no, some, any, many, much, a lot of) to refer to familiar objects.' },
  { stage: 3, strand: 'Use of English', substrand: 'Sentence structure', code: '3Us.02', objective: 'Use common demonstrative pronouns to ask and answer simple questions.' },
  { stage: 3, strand: 'Use of English', substrand: 'Sentence structure', code: '3Us.03', objective: 'Use direct and indirect personal pronouns in descriptions of events and actions.' },
  { stage: 3, strand: 'Use of English', substrand: 'Sentence structure', code: '3Us.04', objective: 'Use connectives (e.g. because) to give reasons.' },
  { stage: 3, strand: 'Use of English', substrand: 'Sentence structure', code: '3Us.05', objective: 'Use common verbs followed by infinitive (e.g. hope to do) and gerund forms (e.g. avoid doing).' },
  { stage: 3, strand: 'Use of English', substrand: 'Sentence structure', code: '3Us.06', objective: 'Begin to use infinitive of purpose.' },

  // ─────────────────────────────────────────────
  // STAGE 4
  // ─────────────────────────────────────────────

  // Listening — Listening for global meaning
  { stage: 4, strand: 'Listening', substrand: 'Listening for global meaning', code: '4Lm.01', objective: 'Understand, with support, most of the main points of short talk.' },

  // Listening — Listening for detail
  { stage: 4, strand: 'Listening', substrand: 'Listening for detail', code: '4Ld.01', objective: 'Understand, with support, a range of instructions.' },
  { stage: 4, strand: 'Listening', substrand: 'Listening for detail', code: '4Ld.02', objective: 'Understand, with support, an increasing range of questions which ask for information.' },
  { stage: 4, strand: 'Listening', substrand: 'Listening for detail', code: '4Ld.03', objective: 'Deduce meaning from context, with little or no support, in short talk.' },
  { stage: 4, strand: 'Listening', substrand: 'Listening for detail', code: '4Ld.04', objective: 'Understand, with little or no support, most specific information and detail of short talk.' },

  // Listening — Listening for opinion
  { stage: 4, strand: 'Listening', substrand: 'Listening for opinion', code: '4Lo.01', objective: 'Recognise, with little or no support, the opinions of the speaker(s) in short talk.' },

  // Speaking — Communication
  { stage: 4, strand: 'Speaking', substrand: 'Communication', code: '4Sc.01', objective: 'Give basic information about themselves and others using a short sequence of sentences.' },
  { stage: 4, strand: 'Speaking', substrand: 'Communication', code: '4Sc.02', objective: 'Describe people, places and objects, and routine past and present actions and events, using a short sequence of sentences.' },
  { stage: 4, strand: 'Speaking', substrand: 'Communication', code: '4Sc.03', objective: 'Ask questions to find out general information on an increasing range of topics and respond accordingly.' },
  { stage: 4, strand: 'Speaking', substrand: 'Communication', code: '4Sc.04', objective: 'Give, with support, a short sequence of instructions.' },
  { stage: 4, strand: 'Speaking', substrand: 'Communication', code: '4Sc.05', objective: 'Pronounce some familiar words and phrases clearly; others may need to ask for repetition from time to time.' },
  { stage: 4, strand: 'Speaking', substrand: 'Communication', code: '4Sc.06', objective: 'Produce a short sequence of sentences to maintain short exchanges, allowing for some hesitation, false starts and reformulation.' },
  { stage: 4, strand: 'Speaking', substrand: 'Communication', code: '4Sc.07', objective: 'Use some simple grammatical structures and sentence patterns correctly, allowing for some basic mistakes.' },

  // Speaking — Express opinion
  { stage: 4, strand: 'Speaking', substrand: 'Express opinion', code: '4So.01', objective: 'Express, with support, opinions and feelings.' },

  // Speaking — Organisation
  { stage: 4, strand: 'Speaking', substrand: 'Organisation', code: '4Sor.01', objective: 'Link, with support, a short sequence of simple sentences using a limited range of connectives.' },
  { stage: 4, strand: 'Speaking', substrand: 'Organisation', code: '4Sor.02', objective: 'Initiate, maintain and conclude interaction, with some support, in an increasing range of exchanges.' },

  // Writing — Communicative achievement
  { stage: 4, strand: 'Writing', substrand: 'Communicative achievement', code: '4Wca.01', objective: 'Use legible handwriting in written work with some speed and fluency.' },
  { stage: 4, strand: 'Writing', substrand: 'Communicative achievement', code: '4Wca.02', objective: 'Spell most high-frequency words accurately when writing independently.' },
  { stage: 4, strand: 'Writing', substrand: 'Communicative achievement', code: '4Wca.03', objective: 'Plan, write, edit and proofread a short sequence of sentences in a paragraph, with support.' },
  { stage: 4, strand: 'Writing', substrand: 'Communicative achievement', code: '4Wca.04', objective: 'Use some simple grammatical structures and sentence patterns correctly, allowing for some mistakes.' },

  // Writing — Organisation
  { stage: 4, strand: 'Writing', substrand: 'Organisation', code: '4Wor.01', objective: 'Punctuate a sequence of sentences in a paragraph during guided writing with some accuracy.' },
  { stage: 4, strand: 'Writing', substrand: 'Organisation', code: '4Wor.02', objective: 'Link, with support, a short sequence of simple sentences using a limited range of connectives to create a paragraph.' },
  { stage: 4, strand: 'Writing', substrand: 'Organisation', code: '4Wor.03', objective: 'Use, with support, appropriate layout for a limited range of written genres.' },

  // Writing — Content
  { stage: 4, strand: 'Writing', substrand: 'Content', code: '4Wc.01', objective: 'Write, with support, a short sequence of instructions.' },
  { stage: 4, strand: 'Writing', substrand: 'Content', code: '4Wc.02', objective: 'Write, with support, a short sequence of simple sentences which describe people, places and objects, and routine past and present actions and events.' },
  { stage: 4, strand: 'Writing', substrand: 'Content', code: '4Wc.03', objective: 'Express, with support, opinions and feelings.' },

  // Reading — Reading for global meaning
  { stage: 4, strand: 'Reading', substrand: 'Reading for global meaning', code: '4Rm.01', objective: 'Understand, with support, some of the main points of short, simple texts.' },
  { stage: 4, strand: 'Reading', substrand: 'Reading for global meaning', code: '4Rm.02', objective: 'Read, with support, an increasing range of short, simple fiction and non-fiction texts with confidence and enjoyment.' },

  // Reading — Reading for detail
  { stage: 4, strand: 'Reading', substrand: 'Reading for detail', code: '4Rd.01', objective: 'Understand, with little or no support, most specific information and detail in short, simple texts.' },
  { stage: 4, strand: 'Reading', substrand: 'Reading for detail', code: '4Rd.02', objective: 'Read and follow an increasing range of instructions.' },
  { stage: 4, strand: 'Reading', substrand: 'Reading for detail', code: '4Rd.03', objective: 'Deduce meaning from context, with little or no support, in short, simple texts.' },
  { stage: 4, strand: 'Reading', substrand: 'Reading for detail', code: '4Rd.04', objective: 'Explore words with common roots and derivations, including links to words in their first language.' },

  // Reading — Reading for opinion
  { stage: 4, strand: 'Reading', substrand: 'Reading for opinion', code: '4Ro.01', objective: 'Recognise, with little or no support, the opinions of the writer(s) in short, simple texts.' },

  // Use of English — Grammatical forms
  { stage: 4, strand: 'Use of English', substrand: 'Grammatical forms', code: '4Ug.01', objective: 'Begin to use tag questions to seek agreement or clarify.' },
  { stage: 4, strand: 'Use of English', substrand: 'Grammatical forms', code: '4Ug.02', objective: 'Use would you like + noun to offer and would you like + verb to invite and use appropriate responses to invitations, yes please, no thank you.' },
  { stage: 4, strand: 'Use of English', substrand: 'Grammatical forms', code: '4Ug.03', objective: 'Use imperative forms [positive and negative] of an increasing range of verbs to give a short sequence of commands and instructions.' },
  { stage: 4, strand: 'Use of English', substrand: 'Grammatical forms', code: '4Ug.04', objective: 'Use present simple regular and irregular forms to describe routines, habits and states.' },
  { stage: 4, strand: 'Use of English', substrand: 'Grammatical forms', code: '4Ug.05', objective: 'Use past simple regular and irregular forms to describe routines, habits and states.' },
  { stage: 4, strand: 'Use of English', substrand: 'Grammatical forms', code: '4Ug.06', objective: 'Use present continuous forms with future meaning.' },
  { stage: 4, strand: 'Use of English', substrand: 'Grammatical forms', code: '4Ug.07', objective: 'Use past continuous forms for background actions.' },
  { stage: 4, strand: 'Use of English', substrand: 'Grammatical forms', code: '4Ug.08', objective: 'Use present perfect forms of common verbs to express what has happened [indefinite time].' },
  { stage: 4, strand: 'Use of English', substrand: 'Grammatical forms', code: '4Ug.09', objective: 'Use future forms will for predictions and be going to to talk about already decided plans.' },
  { stage: 4, strand: 'Use of English', substrand: 'Grammatical forms', code: '4Ug.10', objective: 'Use have [got] to/had to to express obligation and might, may, could to express possibility.' },
  { stage: 4, strand: 'Use of English', substrand: 'Grammatical forms', code: '4Ug.11', objective: 'Use an increasing range of adjectives and comparative and superlative adjectives [regular and irregular].' },

  // Use of English — Vocabulary
  { stage: 4, strand: 'Use of English', substrand: 'Vocabulary', code: '4Uv.01', objective: 'Use like to describe things and about to denote topic.' },
  { stage: 4, strand: 'Use of English', substrand: 'Vocabulary', code: '4Uv.02', objective: 'Use prepositions of direction (e.g. into, out of, from, towards).' },
  { stage: 4, strand: 'Use of English', substrand: 'Vocabulary', code: '4Uv.03', objective: 'Use adverbs of indefinite time (e.g. yet, ever, already, always).' },
  { stage: 4, strand: 'Use of English', substrand: 'Vocabulary', code: '4Uv.04', objective: 'Use comparative and superlative forms of common adverbs.' },
  { stage: 4, strand: 'Use of English', substrand: 'Vocabulary', code: '4Uv.05', objective: 'Use an increasing range of countable and uncountable nouns.' },

  // Use of English — Sentence structure
  { stage: 4, strand: 'Use of English', substrand: 'Sentence structure', code: '4Us.01', objective: 'Use an increasing range of quantifiers (e.g. each, every, a few, few, a little, little).' },
  { stage: 4, strand: 'Use of English', substrand: 'Sentence structure', code: '4Us.02', objective: 'Use a limited range of indefinite pronouns (e.g. some, any, something, nothing, anything).' },
  { stage: 4, strand: 'Use of English', substrand: 'Sentence structure', code: '4Us.03', objective: 'Use connectives (e.g. when, before, after, then) to link parts of sentences.' },
  { stage: 4, strand: 'Use of English', substrand: 'Sentence structure', code: '4Us.04', objective: 'Use defining relative clauses with which, who, that, where to give personal information.' },
  { stage: 4, strand: 'Use of English', substrand: 'Sentence structure', code: '4Us.05', objective: 'Use when/before/after subordinate clauses to describe simple present and past actions.' },
  { stage: 4, strand: 'Use of English', substrand: 'Sentence structure', code: '4Us.06', objective: 'Use an increasing range of verbs followed by infinitive and gerund forms.' },
  { stage: 4, strand: 'Use of English', substrand: 'Sentence structure', code: '4Us.07', objective: 'Use infinitive of purpose.' },

  // ─────────────────────────────────────────────
  // STAGE 5
  // ─────────────────────────────────────────────

  // Listening — Listening for global meaning
  { stage: 5, strand: 'Listening', substrand: 'Listening for global meaning', code: '5Lm.01', objective: 'Understand, with little or no support, most of the main points of short talk.' },

  // Listening — Listening for detail
  { stage: 5, strand: 'Listening', substrand: 'Listening for detail', code: '5Ld.01', objective: 'Understand, with little or no support, a range of instructions.' },
  { stage: 5, strand: 'Listening', substrand: 'Listening for detail', code: '5Ld.02', objective: 'Understand a range of questions which ask for information.' },
  { stage: 5, strand: 'Listening', substrand: 'Listening for detail', code: '5Ld.03', objective: 'Deduce meaning from context in short talk.' },
  { stage: 5, strand: 'Listening', substrand: 'Listening for detail', code: '5Ld.04', objective: 'Understand specific information and detail of short talk.' },

  // Listening — Listening for opinion
  { stage: 5, strand: 'Listening', substrand: 'Listening for opinion', code: '5Lo.01', objective: 'Recognise the opinions of the speaker(s) in short talk.' },

  // Speaking — Communication
  { stage: 5, strand: 'Speaking', substrand: 'Communication', code: '5Sc.01', objective: 'Give more detailed information about themselves and others using a sequence of sentences.' },
  { stage: 5, strand: 'Speaking', substrand: 'Communication', code: '5Sc.02', objective: 'Describe people, places and objects, and routine past and present actions and events, using a sequence of sentences.' },
  { stage: 5, strand: 'Speaking', substrand: 'Communication', code: '5Sc.03', objective: 'Ask questions to find out general information on a range of topics and respond accordingly.' },
  { stage: 5, strand: 'Speaking', substrand: 'Communication', code: '5Sc.04', objective: 'Give, with little or no support, a short sequence of instructions.' },
  { stage: 5, strand: 'Speaking', substrand: 'Communication', code: '5Sc.05', objective: 'Pronounce familiar words and phrases clearly; others may need to ask for repetition from time to time.' },
  { stage: 5, strand: 'Speaking', substrand: 'Communication', code: '5Sc.06', objective: 'Produce a sequence of sentences to maintain a range of exchanges, allowing for some hesitation, false starts and reformulation.' },
  { stage: 5, strand: 'Speaking', substrand: 'Communication', code: '5Sc.07', objective: 'Use simple grammatical structures and sentence patterns correctly, allowing for occasional, basic mistakes.' },

  // Speaking — Express opinion
  { stage: 5, strand: 'Speaking', substrand: 'Express opinion', code: '5So.01', objective: 'Express, with little or no support, opinions and feelings.' },

  // Speaking — Organisation
  { stage: 5, strand: 'Speaking', substrand: 'Organisation', code: '5Sor.01', objective: 'Link, with little or no support, a short sequence of simple sentences using an increasing range of connectives.' },
  { stage: 5, strand: 'Speaking', substrand: 'Organisation', code: '5Sor.02', objective: 'Initiate, maintain and conclude interaction, with little or no support, in a range of exchanges.' },

  // Writing — Communicative achievement
  { stage: 5, strand: 'Writing', substrand: 'Communicative achievement', code: '5Wca.01', objective: 'Use legible handwriting in written work with increasing speed and fluency.' },
  { stage: 5, strand: 'Writing', substrand: 'Communicative achievement', code: '5Wca.02', objective: 'Spell high-frequency words accurately on an increasing range of familiar topics when writing independently.' },
  { stage: 5, strand: 'Writing', substrand: 'Communicative achievement', code: '5Wca.03', objective: 'Plan, write, edit and proofread short texts, with support.' },
  { stage: 5, strand: 'Writing', substrand: 'Communicative achievement', code: '5Wca.04', objective: 'Use simple grammatical structures and sentence patterns correctly, allowing for occasional mistakes.' },

  // Writing — Organisation
  { stage: 5, strand: 'Writing', substrand: 'Organisation', code: '5Wor.01', objective: 'Punctuate short texts during guided writing with some accuracy.' },
  { stage: 5, strand: 'Writing', substrand: 'Organisation', code: '5Wor.02', objective: 'Link, with little or no support, a short sequence of sentences using an increasing range of connectives to create a short text organised into paragraphs.' },
  { stage: 5, strand: 'Writing', substrand: 'Organisation', code: '5Wor.03', objective: 'Use, with little or no support, appropriate layout for a limited range of written genres.' },

  // Writing — Content
  { stage: 5, strand: 'Writing', substrand: 'Content', code: '5Wc.01', objective: 'Write, with little or no support, a short sequence of instructions.' },
  { stage: 5, strand: 'Writing', substrand: 'Content', code: '5Wc.02', objective: 'Write, with little or no support, a short sequence of simple sentences which describe people, places and objects, and routine past and present actions and events.' },
  { stage: 5, strand: 'Writing', substrand: 'Content', code: '5Wc.03', objective: 'Express, with little or no support, opinions and feelings.' },

  // Reading — Reading for global meaning
  { stage: 5, strand: 'Reading', substrand: 'Reading for global meaning', code: '5Rm.01', objective: 'Understand, with little or no support, most of the main points of short texts.' },
  { stage: 5, strand: 'Reading', substrand: 'Reading for global meaning', code: '5Rm.02', objective: 'Read, with little or no support, a range of short, simple fiction and non-fiction texts with confidence and enjoyment.' },

  // Reading — Reading for detail
  { stage: 5, strand: 'Reading', substrand: 'Reading for detail', code: '5Rd.01', objective: 'Understand most specific information and detail in short texts.' },
  { stage: 5, strand: 'Reading', substrand: 'Reading for detail', code: '5Rd.02', objective: 'Read and follow a range of instructions.' },
  { stage: 5, strand: 'Reading', substrand: 'Reading for detail', code: '5Rd.03', objective: 'Deduce meaning from context in short texts.' },
  { stage: 5, strand: 'Reading', substrand: 'Reading for detail', code: '5Rd.04', objective: 'Identify and explore words with common roots and compare their meanings.' },

  // Reading — Reading for opinion
  { stage: 5, strand: 'Reading', substrand: 'Reading for opinion', code: '5Ro.01', objective: 'Recognise the opinions of the writer(s) in short texts.' },

  // Use of English — Grammatical forms
  { stage: 5, strand: 'Use of English', substrand: 'Grammatical forms', code: '5Ug.01', objective: 'Use tag questions to seek agreement or clarify.' },
  { stage: 5, strand: 'Use of English', substrand: 'Grammatical forms', code: '5Ug.02', objective: 'Use imperative forms with direct and indirect object forms to give a short sequence of commands and instructions.' },
  { stage: 5, strand: 'Use of English', substrand: 'Grammatical forms', code: '5Ug.03', objective: 'Use an increasing range of present simple forms to describe routines, habits and states.' },
  { stage: 5, strand: 'Use of English', substrand: 'Grammatical forms', code: '5Ug.04', objective: 'Use an increasing range of past simple forms to describe routines, habits and states.' },
  { stage: 5, strand: 'Use of English', substrand: 'Grammatical forms', code: '5Ug.05', objective: 'Use present continuous forms with present and future meaning.' },
  { stage: 5, strand: 'Use of English', substrand: 'Grammatical forms', code: '5Ug.06', objective: 'Use past continuous forms for background and interrupted past actions.' },
  { stage: 5, strand: 'Use of English', substrand: 'Grammatical forms', code: '5Ug.07', objective: 'Use present perfect forms to express what has happened [indefinite time and unfinished past] with for and since.' },
  { stage: 5, strand: 'Use of English', substrand: 'Grammatical forms', code: '5Ug.08', objective: 'Use an increasing range of future forms, including present continuous and present simple with future meaning.' },
  { stage: 5, strand: 'Use of English', substrand: 'Grammatical forms', code: '5Ug.09', objective: 'Begin to use if clauses in zero conditionals.' },
  { stage: 5, strand: 'Use of English', substrand: 'Grammatical forms', code: '5Ug.10', objective: 'Use modal forms (e.g. mustn\'t [prohibition], need [necessity], would, could [polite requests]).' },
  { stage: 5, strand: 'Use of English', substrand: 'Grammatical forms', code: '5Ug.11', objective: 'Use a range of adjectives, including common participle adjectives (e.g. bored/boring) and comparative and superlative adjectives in the correct order in front of nouns.' },

  // Use of English — Vocabulary
  { stage: 5, strand: 'Use of English', substrand: 'Vocabulary', code: '5Uv.01', objective: 'Begin to use common dependent prepositions following adjectives (e.g. good at).' },
  { stage: 5, strand: 'Use of English', substrand: 'Vocabulary', code: '5Uv.02', objective: 'Use a limited range of prepositions preceding nouns.' },
  { stage: 5, strand: 'Use of English', substrand: 'Vocabulary', code: '5Uv.03', objective: 'Use a range of prepositions to talk about time, location, position and direction.' },
  { stage: 5, strand: 'Use of English', substrand: 'Vocabulary', code: '5Uv.04', objective: 'Use a range of adverbs of indefinite time (e.g. for, since).' },
  { stage: 5, strand: 'Use of English', substrand: 'Vocabulary', code: '5Uv.05', objective: 'Use comparative and superlative forms with a range of adverbs.' },
  { stage: 5, strand: 'Use of English', substrand: 'Vocabulary', code: '5Uv.06', objective: 'Use adverbs of degree (e.g. too, not enough, quite, rather).' },
  { stage: 5, strand: 'Use of English', substrand: 'Vocabulary', code: '5Uv.07', objective: 'Use common abstract nouns and compound nouns.' },
  { stage: 5, strand: 'Use of English', substrand: 'Vocabulary', code: '5Uv.08', objective: 'Use common impersonal structures with it, there.' },

  // Use of English — Sentence structure
  { stage: 5, strand: 'Use of English', substrand: 'Sentence structure', code: '5Us.01', objective: 'Use a range of quantifiers (e.g. both, all, less, fewer, not as many, not as much).' },
  { stage: 5, strand: 'Use of English', substrand: 'Sentence structure', code: '5Us.02', objective: 'Use an increasing range of indefinite pronouns (e.g. someone, somebody, everybody, no-one).' },
  { stage: 5, strand: 'Use of English', substrand: 'Sentence structure', code: '5Us.03', objective: 'Use connectives (e.g. so, when) in short texts.' },
  { stage: 5, strand: 'Use of English', substrand: 'Sentence structure', code: '5Us.04', objective: 'Use an increasing range of defining relative clauses to give personal information and details.' },
  { stage: 5, strand: 'Use of English', substrand: 'Sentence structure', code: '5Us.05', objective: 'Use subordinate clauses following sure, certain, think, know, believe, hope.' },
  { stage: 5, strand: 'Use of English', substrand: 'Sentence structure', code: '5Us.06', objective: 'Use a range of verbs followed by infinitive and gerund forms.' },

  // ─────────────────────────────────────────────
  // STAGE 6
  // ─────────────────────────────────────────────

  // Listening — Listening for global meaning
  { stage: 6, strand: 'Listening', substrand: 'Listening for global meaning', code: '6Lm.01', objective: 'Understand, with support, most of the main points of short and extended talk.' },

  // Listening — Listening for detail
  { stage: 6, strand: 'Listening', substrand: 'Listening for detail', code: '6Ld.01', objective: 'Understand a range of instructions.' },
  { stage: 6, strand: 'Listening', substrand: 'Listening for detail', code: '6Ld.02', objective: 'Understand a range of questions which ask for detailed information.' },
  { stage: 6, strand: 'Listening', substrand: 'Listening for detail', code: '6Ld.03', objective: 'Deduce meaning from context, with support, in short and extended talk.' },
  { stage: 6, strand: 'Listening', substrand: 'Listening for detail', code: '6Ld.04', objective: 'Understand, with support, most specific information and detail of short and extended talk.' },
  { stage: 6, strand: 'Listening', substrand: 'Listening for detail', code: '6Ld.05', objective: 'Understand, with support, most of the detail of an argument in short and extended talk.' },

  // Listening — Listening for opinion
  { stage: 6, strand: 'Listening', substrand: 'Listening for opinion', code: '6Lo.01', objective: 'Recognise, with support, the opinions of the speaker(s) in short and extended talk.' },

  // Speaking — Communication
  { stage: 6, strand: 'Speaking', substrand: 'Communication', code: '6Sc.01', objective: 'Give detailed information about themselves and others.' },
  { stage: 6, strand: 'Speaking', substrand: 'Communication', code: '6Sc.02', objective: 'Describe people, places and objects, and routine past and present actions and events.' },
  { stage: 6, strand: 'Speaking', substrand: 'Communication', code: '6Sc.03', objective: 'Ask questions to find out information and to clarify meaning on a range of topics and respond accordingly.' },
  { stage: 6, strand: 'Speaking', substrand: 'Communication', code: '6Sc.04', objective: 'Give a sequence of instructions.' },
  { stage: 6, strand: 'Speaking', substrand: 'Communication', code: '6Sc.05', objective: 'Pronounce familiar words and phrases clearly; begin to use intonation and place stress at word, phrase and sentence level appropriately.' },
  { stage: 6, strand: 'Speaking', substrand: 'Communication', code: '6Sc.06', objective: 'Begin to produce and maintain stretches of language comprehensibly, allowing for hesitation and reformulation, especially in longer stretches of free production.' },
  { stage: 6, strand: 'Speaking', substrand: 'Communication', code: '6Sc.07', objective: 'Use grammatical structures correctly, allowing for occasional mistakes.' },

  // Speaking — Express opinion
  { stage: 6, strand: 'Speaking', substrand: 'Express opinion', code: '6So.01', objective: 'Express opinions, feelings and reactions.' },

  // Speaking — Organisation
  { stage: 6, strand: 'Speaking', substrand: 'Organisation', code: '6Sor.01', objective: 'Link sentences using an increasing range of connectives.' },
  { stage: 6, strand: 'Speaking', substrand: 'Organisation', code: '6Sor.02', objective: 'Briefly summarise what others say, with support, in a range of exchanges in order to achieve a shared outcome.' },

  // Writing — Communicative achievement
  { stage: 6, strand: 'Writing', substrand: 'Communicative achievement', code: '6Wca.01', objective: 'Use legible handwriting in written work with appropriate speed and fluency.' },
  { stage: 6, strand: 'Writing', substrand: 'Communicative achievement', code: '6Wca.02', objective: 'Spell most familiar words accurately on a range of familiar topics when writing independently.' },
  { stage: 6, strand: 'Writing', substrand: 'Communicative achievement', code: '6Wca.03', objective: 'Plan, write, edit and proofread short texts, with little or no support.' },
  { stage: 6, strand: 'Writing', substrand: 'Communicative achievement', code: '6Wca.04', objective: 'Use grammatical structures correctly, allowing for occasional mistakes.' },

  // Writing — Organisation
  { stage: 6, strand: 'Writing', substrand: 'Organisation', code: '6Wor.01', objective: 'Punctuate short texts with some accuracy when writing independently.' },
  { stage: 6, strand: 'Writing', substrand: 'Organisation', code: '6Wor.02', objective: 'Link sentences using an increasing range of connectives to create a short text organised into paragraphs.' },
  { stage: 6, strand: 'Writing', substrand: 'Organisation', code: '6Wor.03', objective: 'Use appropriate layout for a limited range of written genres.' },

  // Writing — Content
  { stage: 6, strand: 'Writing', substrand: 'Content', code: '6Wc.01', objective: 'Write a sequence of instructions.' },
  { stage: 6, strand: 'Writing', substrand: 'Content', code: '6Wc.02', objective: 'Write, with support, short texts which describe people, places and objects, and routine past and present actions and events.' },
  { stage: 6, strand: 'Writing', substrand: 'Content', code: '6Wc.03', objective: 'Express opinions and feelings.' },

  // Reading — Reading for global meaning
  { stage: 6, strand: 'Reading', substrand: 'Reading for global meaning', code: '6Rm.01', objective: 'Understand, with support, most of the main points of short and extended texts.' },
  { stage: 6, strand: 'Reading', substrand: 'Reading for global meaning', code: '6Rm.02', objective: 'Read independently a range of short, simple fiction and non-fiction texts with confidence and enjoyment.' },

  // Reading — Reading for detail
  { stage: 6, strand: 'Reading', substrand: 'Reading for detail', code: '6Rd.01', objective: 'Understand, with support, most specific information and detail in short and extended texts.' },
  { stage: 6, strand: 'Reading', substrand: 'Reading for detail', code: '6Rd.02', objective: 'Read and follow instructions.' },
  { stage: 6, strand: 'Reading', substrand: 'Reading for detail', code: '6Rd.03', objective: 'Understand, with support, most of the detail of an argument in short and extended texts.' },
  { stage: 6, strand: 'Reading', substrand: 'Reading for detail', code: '6Rd.04', objective: 'Deduce meaning from context, with support, in short and extended texts.' },
  { stage: 6, strand: 'Reading', substrand: 'Reading for detail', code: '6Rd.05', objective: 'Explore common idiomatic phrases and their meanings.' },

  // Reading — Reading for opinion
  { stage: 6, strand: 'Reading', substrand: 'Reading for opinion', code: '6Ro.01', objective: 'Recognise, with support, the opinions of the writer(s) in short and extended texts.' },

  // Use of English — Grammatical forms
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.01', objective: 'Use a limited range of verb forms to ask questions to develop ideas and extend understanding.' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.02', objective: 'Use what/how about + noun/-ing to make suggestions.' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.03', objective: 'Use a range of present simple active forms and begin to use passive forms.' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.04', objective: 'Use a range of past simple active forms for habits and states and begin to use passive forms.' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.05', objective: 'Use an increasing range of present continuous forms with present and future meaning.' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.06', objective: 'Use past continuous forms for background, parallel and interrupted past actions.' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.07', objective: 'Use present perfect forms to express recent, indefinite and unfinished past.' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.08', objective: 'Use a range of future forms, including present continuous and present simple with future meaning.' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.09', objective: 'Begin to use if clauses in first conditionals.' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.10', objective: 'Use common prepositional verbs (e.g. walk away).' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.11', objective: 'Begin to use simple forms of reported speech to report statements and commands.' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.12', objective: 'Use an increasing range of modal forms (e.g. needn\'t [lack of necessity], should [advice], ought to [advice/obligation]).' },
  { stage: 6, strand: 'Use of English', substrand: 'Grammatical forms', code: '6Ug.13', objective: 'Use an increasing range of participle adjectives and a range of adjectives in the correct order in front of nouns.' },

  // Use of English — Vocabulary
  { stage: 6, strand: 'Use of English', substrand: 'Vocabulary', code: '6Uv.01', objective: 'Use common dependent prepositions following adjectives.' },
  { stage: 6, strand: 'Use of English', substrand: 'Vocabulary', code: '6Uv.02', objective: 'Use an increasing range of prepositions preceding nouns.' },
  { stage: 6, strand: 'Use of English', substrand: 'Vocabulary', code: '6Uv.03', objective: 'Use prepositions (e.g. as, like) to indicate manner.' },
  { stage: 6, strand: 'Use of English', substrand: 'Vocabulary', code: '6Uv.04', objective: 'Use a wide range of adverbs of definite and indefinite time.' },
  { stage: 6, strand: 'Use of English', substrand: 'Vocabulary', code: '6Uv.05', objective: 'Use comparative and superlative forms with regular and irregular adverbs.' },
  { stage: 6, strand: 'Use of English', substrand: 'Vocabulary', code: '6Uv.06', objective: 'Use collective nouns.' },
  { stage: 6, strand: 'Use of English', substrand: 'Vocabulary', code: '6Uv.07', objective: 'Use a limited range of abstract nouns and compound nouns.' },

  // Use of English — Sentence structure
  { stage: 6, strand: 'Use of English', substrand: 'Sentence structure', code: '6Us.01', objective: 'Use a wide range of quantifiers (e.g. either, neither, both [of], several, plenty).' },
  { stage: 6, strand: 'Use of English', substrand: 'Sentence structure', code: '6Us.02', objective: 'Use reciprocal pronouns (each other, one another) and a range of indefinite pronouns.' },
  { stage: 6, strand: 'Use of English', substrand: 'Sentence structure', code: '6Us.03', objective: 'Use reflexive pronouns.' },
  { stage: 6, strand: 'Use of English', substrand: 'Sentence structure', code: '6Us.04', objective: 'Use connectives (e.g. while, until, as soon as) in short texts.' },
  { stage: 6, strand: 'Use of English', substrand: 'Sentence structure', code: '6Us.05', objective: 'Use an increasing range of defining relative clauses (e.g. with whose and whom) and begin to use non-defining relative clauses.' },
  { stage: 6, strand: 'Use of English', substrand: 'Sentence structure', code: '6Us.06', objective: 'Use subordinate clauses following say and tell.' },
  { stage: 6, strand: 'Use of English', substrand: 'Sentence structure', code: '6Us.07', objective: 'Use the patterns verb + object + infinitive (e.g. have something to do) and give/take/send/bring/show + direct/indirect object.' },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🔤 Starting Cambridge Primary English as a Second Language seed...');
    console.log(`📚 Total objectives to insert: ${objectives.length}`);

    await client.query(
      `DELETE FROM curriculum WHERE subject = 'English' AND curriculum_type = 'Cambridge Primary'`
    );
    console.log('🗑️  Cleared existing English curriculum entries.');

    let inserted = 0;
    for (const obj of objectives) {
      await client.query(
        `INSERT INTO curriculum
          (subject, grade, stage, strand, substrand, code, objective, curriculum_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          'English',
          obj.stage,
          obj.stage,
          obj.strand,
          obj.substrand,
          obj.code,
          obj.objective,
          'Cambridge Primary'
        ]
      );
      inserted++;
      if (inserted % 20 === 0) {
        console.log(`  ✅ Inserted ${inserted}/${objectives.length} objectives...`);
      }
    }

    console.log(`\n🎉 Done! Inserted ${inserted} Cambridge Primary English (ESL) objectives.`);
    console.log('\n📊 Breakdown by Stage:');
    for (let s = 1; s <= 6; s++) {
      const count = objectives.filter(o => o.stage === s).length;
      console.log(`   Stage ${s}: ${count} objectives`);
    }
    console.log('\n📦 Breakdown by Strand:');
    const strands = [...new Set(objectives.map(o => o.strand))];
    for (const strand of strands) {
      const count = objectives.filter(o => o.strand === strand).length;
      console.log(`   ${strand}: ${count} objectives`);
    }

  } catch (err) {
    console.error('❌ Seed error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
