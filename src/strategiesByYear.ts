export interface YearStrategyItem {
  id: string;
  gap: string;
  strategy: string;
  technique: string;
}

export type YearGroupNumber = 7 | 8 | 9 | 10 | 11;

export const STRATEGIES_BY_YEAR: Record<YearGroupNumber, YearStrategyItem[]> = {
  7: [
    {
      id: 'y7-1',
      gap: 'Cannot recall more than one or two time phrases from memory.',
      strategy: 'Time phrase retrieval grid: five blank boxes on entry, write five time phrases in three minutes, no book.',
      technique: 'Do Now',
    },
    {
      id: 'y7-2',
      gap: 'Knows the word "porque" but cannot finish the reason chunk.',
      strategy: 'Finish my reason: say "Me gusta el inglés porque..." and cold call three students to finish it differently.',
      technique: 'Cold Call',
    },
    {
      id: 'y7-3',
      gap: 'Stops at the activity and forgets the G completely.',
      strategy: 'Letter check: "Show me the G in this sentence." Students underline it and hold up.',
      technique: 'Show Me',
    },
    {
      id: 'y7-4',
      gap: 'Uses only "es divertido" or "es aburrido" as opinions.',
      strategy: 'Opinion upgrade ladder: a student says "es divertido", you ask for a better one until they reach "es emocionante".',
      technique: 'Stretch It',
    },
    {
      id: 'y7-5',
      gap: 'Cannot say what each letter of TAG or MAG stands for when asked cold.',
      strategy: 'Say it without the builder: a student who says "I don\'t know" hears two peers answer, then repeats the full sentence.',
      technique: 'No Opt Out',
    },
    {
      id: 'y7-6',
      gap: 'Relies on the sentence builder to start every sentence and freezes without it.',
      strategy: 'TAG order drill: accept answers only in full TAG order. "Try that again in the right order."',
      technique: 'Format Matters',
    },
    {
      id: 'y7-7',
      gap: 'Mixes up the order and loses the flow of the sentence.',
      strategy: 'Chunk hunt: play a 20 second clip, everyone writes the time phrase they heard before anyone speaks.',
      technique: 'Everybody Writes',
    },
    {
      id: 'y7-8',
      gap: 'Cannot turn a written TAG answer into a spoken answer without reading it.',
      strategy: 'Sentence stretch: pairs take turns adding one letter (T, then A, then G) to build a sentence aloud.',
      technique: 'Turn and Talk',
    },
    {
      id: 'y7-9',
      gap: 'Does not recognise TAG chunks when they hear them in a listening text.',
      strategy: 'Error on the board: show a sentence with the G missing. "What has this student forgotten?"',
      technique: 'Culture of Error',
    },
    {
      id: 'y7-10',
      gap: 'Writes one TAG sentence and thinks the task is finished.',
      strategy: 'Two sentence minimum: one TAG sentence is not a complete answer. Hold out for two.',
      technique: 'Right is Right',
    },
  ],
  8: [
    {
      id: 'y8-1',
      gap: 'Leaves out the N (noun or detail), so sentences stay vague.',
      strategy: 'Add the N: take a student\'s TAG and ask "with who? where?" until a detail is added.',
      technique: 'Stretch It',
    },
    {
      id: 'y8-2',
      gap: 'Uses the same activity verb in every sentence.',
      strategy: 'Verb bank retrieval: write six different activity verbs in two minutes, share, add missing ones.',
      technique: 'Do Now',
    },
    {
      id: 'y8-3',
      gap: 'Knows "porque" but no other way into the O (sin embargo, también, además).',
      strategy: 'Connector swap: give a TANGO, students rewrite the O with a connector other than "porque".',
      technique: 'Show Me',
    },
    {
      id: 'y8-4',
      gap: 'Cannot give a detail that answers "with who?" or "where?".',
      strategy: 'Topic transfer: "That was free time. Now give me a TANGO about school."',
      technique: 'Cold Call',
    },
    {
      id: 'y8-5',
      gap: 'Writes a TANGO but cannot say it aloud with confidence.',
      strategy: 'Sense check: if the opinion clashes with the activity, do not accept it. "Does that make sense?"',
      technique: 'Right is Right',
    },
    {
      id: 'y8-6',
      gap: 'Recalls TANGO for one topic (free time) but not for school or family.',
      strategy: 'Label the text: students label T, A, N, G, O in the margin of a short text before discussion.',
      technique: 'Everybody Writes',
    },
    {
      id: 'y8-7',
      gap: 'Gives an opinion that does not match the activity.',
      strategy: 'Show call a strong TANGO: project one student\'s sentence, class names what makes it strong.',
      technique: 'Show Call',
    },
    {
      id: 'y8-8',
      gap: 'Cannot spot a TANGO structure in a reading text and label its parts.',
      strategy: 'Read, cover, say: Partner A reads, covers, says their TANGO. Partner B ticks each letter heard.',
      technique: 'Turn and Talk',
    },
    {
      id: 'y8-9',
      gap: 'Knows the acronym, but not why each part adds interest or marks.',
      strategy: 'Adapt the model: give a model, students change three parts to make it their own.',
      technique: 'Break It Down',
    },
    {
      id: 'y8-10',
      gap: 'Copies model TANGO sentences word for word without adapting.',
      strategy: 'Why does this part matter?: before writing, class names what each letter adds.',
      technique: 'Name the Steps',
    },
  ],
  9: [
    {
      id: 'y9-1',
      gap: 'Can produce TANGO in the present but cannot shift it into the past (Retro).',
      strategy: 'Time phrase sorting: nine time phrases on the board, sort into past, present, future in three minutes.',
      technique: 'Do Now',
    },
    {
      id: 'y9-2',
      gap: 'Cannot shift it into the future (Futuristic).',
      strategy: 'Retro switch: give a present TANGO, students rewrite it Retro on whiteboards.',
      technique: 'Show Me',
    },
    {
      id: 'y9-3',
      gap: 'Does not know which time phrases signal past or future (el verano pasado, el año que viene).',
      strategy: 'Futuristic switch: "Now make that future." Cold call one student, then a second to improve it.',
      technique: 'Cold Call',
    },
    {
      id: 'y9-4',
      gap: 'Leaves out the other time frame in MANGO.',
      strategy: 'Where\'s your O?: any MANGO missing the other time frame goes back until complete.',
      technique: 'No Opt Out',
    },
    {
      id: 'y9-5',
      gap: 'Uses the same reason chunks from Year 7 and never upgrades.',
      strategy: 'Reason upgrade bank: ban "es divertido", students must use a new reason from the Year 9 bank.',
      technique: 'Stretch It',
    },
    {
      id: 'y9-6',
      gap: 'Cannot combine two frames (TANGO plus MANGO) into one longer answer.',
      strategy: 'Frame stacking: model joining TANGO and MANGO live, then pairs do it on a new topic.',
      technique: 'Break It Down',
    },
    {
      id: 'y9-7',
      gap: 'Cannot answer an unexpected question using a frame they already know.',
      strategy: 'Unexpected question drill: surprise question, five seconds silent thinking, then cold call.',
      technique: 'Wait Time',
    },
    {
      id: 'y9-8',
      gap: 'Recognises Retro sentences in writing but not when heard in listening.',
      strategy: 'Listening time frame hunt: students write P, N or F for each sentence heard.',
      technique: 'Everybody Writes',
    },
    {
      id: 'y9-9',
      gap: 'Cannot self check their own paragraph against the frame.',
      strategy: 'Self check: students tick each letter of MANGO in their own paragraph before handing in.',
      technique: 'Check for Understanding',
    },
    {
      id: 'y9-10',
      gap: 'Avoids longer answers in speaking even when the frame is secure.',
      strategy: 'Long answer rehearsal: choral, then pairs, then individual.',
      technique: 'Means of Participation',
    },
  ],
  10: [
    {
      id: 'y10-1',
      gap: 'SPEAKING, ROLE PLAY: answers prompts with single words instead of full chunks, and does not recognise when a prompt needs a past or future answer.',
      strategy: 'Role play full chunk rule: single word answers not accepted. Students circle the time signal in each prompt first.',
      technique: 'Right is Right',
    },
    {
      id: 'y10-2',
      gap: 'SPEAKING, READ ALOUD: does not know where frame chunks start and stop, so pauses in the wrong places, then answers the follow up questions with one short sentence.',
      strategy: 'Read aloud chunking: students mark chunk breaks with a slash before reading aloud, then give a TANGO answer to one follow up question.',
      technique: 'Format Matters',
    },
    {
      id: 'y10-3',
      gap: 'SPEAKING, PHOTO CARD: can say what is in the photo but does not see that the unprepared conversation is just TANGO and MANGO answers.',
      strategy: 'Photo card equals TANGO: model describing the photo, then answering a follow up with TANGO. Students copy the steps.',
      technique: 'Name the Steps',
    },
    {
      id: 'y10-4',
      gap: 'WRITING, PHOTO DESCRIPTION (Foundation): writes lists of nouns ("hay una playa") instead of short full sentences with a detail or opinion.',
      strategy: 'Photo sentence upgrade: "Hay una playa" becomes "En la foto hay una playa con mucha gente y parece divertido."',
      technique: 'Stretch It',
    },
    {
      id: 'y10-5',
      gap: 'WRITING, 50 WORD TASK (Foundation): covers some bullets but not all, or writes one long sentence for one bullet and nothing for the rest.',
      strategy: 'Bullet tick box: for the 50 word task, students write one sentence per bullet and tick each bullet before adding extra.',
      technique: 'Everybody Writes',
    },
    {
      id: 'y10-6',
      gap: 'WRITING, 90 WORD TASK (Foundation and Higher): cannot match each bullet to the right frame (for example Retro for a past bullet).',
      strategy: 'Bullet to frame mapping: for each 90 word bullet, students write which frame they will use on whiteboards.',
      technique: 'Show Me',
    },
    {
      id: 'y10-7',
      gap: 'WRITING, TRANSLATION INTO SPANISH: does not spot the familiar frame chunks hidden in the English sentences.',
      strategy: 'Translation chunk spotting: give English sentences, students box the chunks they already know in Spanish.',
      technique: 'Show Me',
    },
    {
      id: 'y10-8',
      gap: 'LISTENING, COMPREHENSION: hears a time phrase but does not use it to predict the tense, and listens only for the activity, missing the detail asked for.',
      strategy: 'Predict the tense: pause listening after the time phrase. "What tense is coming? What detail might they give?"',
      technique: 'Cold Call',
    },
    {
      id: 'y10-9',
      gap: 'LISTENING, DICTATION: does not use knowledge of familiar chunks to guess spellings.',
      strategy: 'Chunk dictation: read out familiar TANGO chunks, students write them, then self mark.',
      technique: 'Everybody Writes',
    },
    {
      id: 'y10-10',
      gap: 'READING, COMPREHENSION AND TRANSLATION INTO ENGLISH: does not recognise frames when phrased differently, and skips small detail words when translating.',
      strategy: 'Steal the phrase: pairs find two reusable phrases in a reading text and every English word in their translation is ticked off.',
      technique: 'Turn and Talk',
    },
  ],
  11: [
    {
      id: 'y11-1',
      gap: 'SPEAKING, ROLE PLAY: loses marks on the unexpected question because they cannot reach for a frame quickly.',
      strategy: 'Unexpected question sprint: three seconds thinking, then a full frame answer to a surprise role play question.',
      technique: 'Wait Time and Cold Call',
    },
    {
      id: 'y11-2',
      gap: 'SPEAKING, READ ALOUD: reads accurately but follow up answers do not include an opinion, reason or time frame.',
      strategy: 'Follow up upgrade: after each read aloud follow up answer, "¿Por qué? ¿Y el año pasado?" until opinion, reason and time frame are in.',
      technique: 'Stretch It',
    },
    {
      id: 'y11-3',
      gap: 'SPEAKING, PHOTO CARD CONVERSATION: misses the time frame in follow up questions and cannot extend beyond one frame.',
      strategy: 'Keep talking: in photo card practice, ask follow ups in past and future. "¿Y qué más?" until two frames are used.',
      technique: 'Stretch It and Cold Call',
    },
    {
      id: 'y11-4',
      gap: 'WRITING, PHOTO DESCRIPTION (Foundation): writes the same structure four times ("hay...", "hay...") with no variety.',
      strategy: 'Four different starters: photo description sentences must each start differently (En la foto, Veo, Parece, Me gusta).',
      technique: 'Right is Right',
    },
    {
      id: 'y11-5',
      gap: 'WRITING, 50 WORD TASK (Foundation): goes well over or under the word guide and does not add an opinion to each bullet.',
      strategy: 'Word guide check: students count and mark each bullet in their 50 word answer for one opinion and roughly the right length.',
      technique: 'Check for Understanding',
    },
    {
      id: 'y11-6',
      gap: 'WRITING, 90 WORD TASK: uses the same frame for every bullet, so answers feel repetitive and miss the required time frames.',
      strategy: 'Frame rotation rule: in the 90 word task each bullet uses a different frame. Repeats go back.',
      technique: 'Right is Right',
    },
    {
      id: 'y11-7',
      gap: 'WRITING, 150 WORD TASK (Higher): runs out of time, does not plan, and does not show a range of frames across both bullets.',
      strategy: 'Timed 150 plan: eight minutes to plan, frame per bullet, first line written only. Builds speed and range.',
      technique: 'Do Now',
    },
    {
      id: 'y11-8',
      gap: 'WRITING, TRANSLATION INTO SPANISH: skips small detail words (también, con mis amigos) and loses marks for missing information.',
      strategy: 'Every word counts: project a translation with missing detail words, class spots what was lost and fixes it.',
      technique: 'Show Call',
    },
    {
      id: 'y11-9',
      gap: 'LISTENING: picks the first activity heard instead of the one with the detail asked for, and falls for distractors.',
      strategy: 'Distractor spotting: before sharing answers, students write the distractor they heard and why it is wrong.',
      technique: 'Everybody Writes',
    },
    {
      id: 'y11-10',
      gap: 'READING: does not recognise frames phrased differently ("lo que más me gusta es...") and revises passively instead of producing chunks from memory.',
      strategy: 'Produce, don\'t reread: blank page recall of frames and alternative phrasings at the start of every revision lesson.',
      technique: 'Retrieval Practice',
    },
  ],
};

export function findStrategyById(id: string): YearStrategyItem | undefined {
  for (const year of [7, 8, 9, 10, 11] as YearGroupNumber[]) {
    const found = STRATEGIES_BY_YEAR[year]?.find((s) => s.id === id);
    if (found) return found;
  }
  return undefined;
}

export function gapMatchesSkills(gapText: string, skills: string[]): boolean {
  if (!skills || skills.length === 0) return false;
  const lower = gapText.toLowerCase();

  const keywordMap: Record<string, string[]> = {
    'Present tense verbs': ['present', 'verb', 'activity verb'],
    'Past tense (preterite)': ['past', 'preterite', 'retro'],
    'Future tense': ['future', 'futuristic'],
    'Opinions and justifications': ['opinion', 'justif', 'reason', 'porque', 'divertido', 'aburrido', 'gusta'],
    'Vocabulary: school and jobs': ['school', 'job', 'instituto', 'family', 'noun', 'detail'],
    'Vocabulary: free time and holidays': ['free time', 'holiday', 'vacation', 'vacaciones'],
    'Reading comprehension': ['reading', 'read aloud', 'read'],
    'Translation into Spanish': ['translat', 'traducc', 'english', 'spanish'],
  };

  return skills.some((skill) => {
    const kws = keywordMap[skill];
    if (kws && kws.some((kw) => lower.includes(kw))) return true;
    const directWords = skill.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && w !== 'into' && w !== 'tense');
    return directWords.some((w) => lower.includes(w));
  });
}

