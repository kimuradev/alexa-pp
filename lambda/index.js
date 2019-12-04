/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');
const i18n = require('i18next');
const sprintf = require('i18next-sprintf-postprocessor');

const questions = require('./questions');

// =========================================================================================================================================
// CONST AND LET 
// =========================================================================================================================================

let ANSWER_LENGTH = 3;
let INVALID_OPTION = false;
let SCORE = 0;
const ANSWER_COUNT = 3;
const GAME_LENGTH = 9;
const SKILL_NAME = 'Partiu Poupar';
const SPEECH_CORRECT = ['Legal', 'Muito bem', 'Show de bola', 'Bacana', 'Debulho', 'Tóp zêra', 'Massa', 'Show'];

// =========================================================================================================================================
// HELPERS
// =========================================================================================================================================

function getRandom(min, max) {
  return Math.floor((Math.random() * ((max - min) + 1)) + min);
}  

function shuffle(o) {
    for(var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
}

function discoveryProfile(score) {
    if (score < 28) {
        return 'CONSERVADOR. Para este perfil, os produtos mais indicados são os de renda fixa: Títulos públicos, C D B, L C, L C I, L C A, C R I e C R A . O ideal é que você entenda bem, cada um destes produtos, e tenha os seus objetivos financeiros bem definidos. Assim ficará mais tranquilo escolher quais colocar na sua carteira. Mesmo sendo conservador, investir uma pequena parte em renda variável, pode fazer sentido pra você.';
    } else if (score >= 28 && score <= 45) {
        return 'MODERADO. Para este perfil, os produtos de renda fixa e renda variável se encaixam muito bem. Fundos de Investimentos, Fundos Imobiliários e Ações podem fazer sentido para você. O ideal é que você entenda bem, cada um destes produtos, e tenha os seus objetivos financeiros bem definidos. Assim ficará mais tranquilo escolher quais colocar na sua carteira.';
    } else {
        return 'AGRESSIVO. Para este perfil, os produtos mais indicados são aqueles com maior potencial de ganhos, que por sua vez também são mais arriscados. Ações, Opções, Fundos de Ações e Cripto-moedas podem fazer sentido para você. O ideal é que você entenda bem, cada um destes produtos, e tenha os seus objetivos financeiros bem definidos. Assim ficará mais tranquilo escolher quais colocar na sua carteira.'
    }
}

function populateGameQuestions(translatedQuestions) {
  const gameQuestions = [];
  let shuffleIndex = [];
  const indexList = [];
  let index = translatedQuestions.length;
  
  if (GAME_LENGTH > index) {
    throw new Error('Invalid Game Length.');
  }

  for (let i = 0; i < translatedQuestions.length; i += 1) {
    indexList.push(i);
  }
  // Shuffle questions 1 to 9
  shuffleIndex = shuffle(indexList.slice(1,));
  for (let i = 0; i < shuffleIndex.length; i+= 1) {
      gameQuestions.push(shuffleIndex[i])
  }
  // Add question 0 as first question
  gameQuestions.unshift(0);
  return gameQuestions;
}

function populateRoundAnswers(
  gameQuestionIndexes,
  currentQuestionIndex,
  translatedQuestions,
  handlerInput
) {
  const { attributesManager } = handlerInput;
  const sessionAttributes = attributesManager.getSessionAttributes();
  const answers = [];
  const translatedQuestion = translatedQuestions[gameQuestionIndexes[currentQuestionIndex]];
  const answersCopy = translatedQuestion[Object.keys(translatedQuestion)[0]].map(a => a.answer).slice()
  let index = answersCopy.length;
  ANSWER_LENGTH = index;

  if (index < ANSWER_COUNT) {
    throw new Error('Not enough answers for question.');
  }

  for (let i = 0; i < ANSWER_LENGTH; i += 1) {
    answers[i] = answersCopy[i];
  }
  
  Object.assign(sessionAttributes, {
    currentQuestion: translatedQuestion
  });

  return answers;
}

function isAnswerSlotValid(intent) {
  const answerSlotFilled = intent
    && intent.slots
    && intent.slots.Answer
    && intent.slots.Answer.value;
  const answerSlotIsInt = answerSlotFilled
    && !Number.isNaN(parseInt(intent.slots.Answer.value, 10));
  return answerSlotIsInt
    && parseInt(intent.slots.Answer.value, 10) <= (ANSWER_LENGTH)
    && parseInt(intent.slots.Answer.value, 10) > 0;
}

function handleUserGuess(userGaveUp, handlerInput) {
  const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
  const { intent } = requestEnvelope.request;

  const answerSlotValid = isAnswerSlotValid(intent);
  let speechOutput = '';
  let speechOutputAnalysis = '';
  let aplFirstPageSpeechOutput = '';
  let aplSecondPageSpeechOutput = '';
  const sessionAttributes = attributesManager.getSessionAttributes();
  const gameQuestions = sessionAttributes.questions;
  let currentQuestionIndex = parseInt(sessionAttributes.currentQuestionIndex, 10);
  const { correctAnswerText } = sessionAttributes;
  const requestAttributes = attributesManager.getRequestAttributes();
  const translatedQuestions = requestAttributes.t('QUESTIONS');
  
  const currentQuestion = sessionAttributes.currentQuestion;
  const currentAnswer = currentQuestion[Object.keys(currentQuestion)[0]][intent.slots.Answer.value - 1].answer;
  const currentScore = currentQuestion[Object.keys(currentQuestion)[0]][intent.slots.Answer.value - 1].score;

  SCORE += parseInt(currentScore, 10);
  console.log('CURRENT SCORE:' + SCORE)
  
  if(!answerSlotValid) {
      INVALID_OPTION = true;
      throw new Error('Invalid Answer Length.');
  }

  // Check if we can exit the game session after GAME_LENGTH questions (zero-indexed)
  if (sessionAttributes.currentQuestionIndex === GAME_LENGTH - 1) {
    console.log('FINAL SCORE: ' + SCORE)
    aplFirstPageSpeechOutput = speechOutput + speechOutputAnalysis;
    aplSecondPageSpeechOutput = requestAttributes.t(
      'GAME_OVER_MESSAGE',
      discoveryProfile(SCORE.toString()),
    ); 
    speechOutput = userGaveUp ? '' : SPEECH_CORRECT[getRandom(0, SPEECH_CORRECT.length - 1)] + '. ';
    speechOutput += speechOutputAnalysis + requestAttributes.t(
      'GAME_OVER_MESSAGE',
      discoveryProfile(SCORE.toString()),
    );

    return responseBuilder
      .speak(speechOutput)
      .getResponse();
  }
  currentQuestionIndex += 1;
  const spokenQuestion = Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0];
  const roundAnswers = populateRoundAnswers(
    gameQuestions,
    currentQuestionIndex,
    translatedQuestions,
    handlerInput
  );
  const questionIndexForSpeech = currentQuestionIndex + 1;
  let repromptText = requestAttributes.t(
    'TELL_QUESTION_MESSAGE',
    questionIndexForSpeech.toString(),
    spokenQuestion
  );

  for (let i = 0; i < ANSWER_LENGTH; i += 1) {
    repromptText += `${i + 1}. ${roundAnswers[i]}. `;
  }
  
  speechOutput += userGaveUp ? '' : SPEECH_CORRECT[getRandom(0, SPEECH_CORRECT.length - 1)] + '. ';
  aplFirstPageSpeechOutput = speechOutput + speechOutputAnalysis;
  aplSecondPageSpeechOutput = repromptText;
  speechOutput += speechOutputAnalysis
    + repromptText;

  const translatedQuestion = translatedQuestions[gameQuestions[currentQuestionIndex]];

  Object.assign(sessionAttributes, {
    speechOutput: repromptText,
    repromptText,
    currentQuestionIndex,
    questions: gameQuestions,
    score: SCORE,
    correctAnswerText: translatedQuestion[Object.keys(translatedQuestion)[0]][0]
  });

  return responseBuilder.speak(speechOutput)
    .reprompt(repromptText)
    .getResponse();
}

function startGame(newGame, handlerInput) {
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  let speechOutput = newGame
    ? requestAttributes.t('NEW_GAME_MESSAGE', requestAttributes.t('GAME_NAME'))
      + requestAttributes.t('WELCOME_MESSAGE', GAME_LENGTH.toString())
    : '';
  let aplFirstPageSpeechOutput = speechOutput;
  const translatedQuestions = requestAttributes.t('QUESTIONS');
  const gameQuestions = populateGameQuestions(translatedQuestions);

  const roundAnswers = populateRoundAnswers(
    gameQuestions,
    0,
    translatedQuestions,
    handlerInput
  );
  const currentQuestionIndex = 0;
  const spokenQuestion = Object.keys(translatedQuestions[gameQuestions[currentQuestionIndex]])[0];
  console.log('GAME QUESTION: '+ gameQuestions)
  console.log('SPOKEN QUESTION: '+ spokenQuestion)
  let repromptText = requestAttributes.t('TELL_QUESTION_MESSAGE', '1', spokenQuestion);

  for (let i = 0; i < ANSWER_LENGTH; i += 1) {
    repromptText += `${i + 1}.  ${roundAnswers[i]}. `;
  }
  
  speechOutput += repromptText;
  const sessionAttributes = {};

  const translatedQuestion = translatedQuestions[gameQuestions[currentQuestionIndex]];

  Object.assign(sessionAttributes, {
    speechOutput: repromptText,
    repromptText,
    currentQuestion: translatedQuestion,
    currentQuestionIndex,
    questions: gameQuestions,
    score: 0,
    correctAnswerText: translatedQuestion[Object.keys(translatedQuestion)[0]][0]
  });

  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    .getResponse();
}

function helpTheUser(newGame, handlerInput) {
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const askMessage = newGame
    ? requestAttributes.t('ASK_MESSAGE_START')
    : requestAttributes.t('REPEAT_QUESTION_MESSAGE') + requestAttributes.t('STOP_MESSAGE');
  let speechOutput = requestAttributes.t('HELP_MESSAGE', GAME_LENGTH) + askMessage;
  const repromptText = requestAttributes.t('HELP_REPROMPT') + askMessage;

  return handlerInput.responseBuilder.speak(speechOutput).reprompt(repromptText).getResponse();
}

// =========================================================================================================================================
// INTERCEPTOR
// =========================================================================================================================================

const LocalizationInterceptor = {
  process(handlerInput) {
    const localizationClient = i18n.use(sprintf).init({
      lng: handlerInput.requestEnvelope.request.locale,
      overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
      resources: languageString,
      returnObjects: true
    });

    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function (...args) {
      return localizationClient.t(...args);
    };
  },
};


// =========================================================================================================================================
// INTENT
// =========================================================================================================================================

const LaunchRequest = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return request.type === 'LaunchRequest'
      || (request.type === 'IntentRequest'
        && request.intent.name === 'AMAZON.StartOverIntent');
  },
  handle(handlerInput) {
    return startGame(true, handlerInput);
  },
};

const HelpIntent = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    const newGame = !(sessionAttributes.questions);
    return helpTheUser(newGame, handlerInput);
  },
};


const UnhandledIntent = {
  canHandle() {
    return true;
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    if (Object.keys(sessionAttributes).length === 0) {
      let speechOutput = requestAttributes.t('START_UNHANDLED');
      let repromptText = speechOutput;

      return handlerInput.attributesManager
        .speak(speechOutput)
        .reprompt(repromptText)
        .getResponse();
    } else if (sessionAttributes.questions) {
      let speechOutput = requestAttributes.t('PP_UNHANDLED', ANSWER_COUNT.toString());
      const repromptText = speechOutput;

      return handlerInput.responseBuilder
        .speak(speechOutput)
        .reprompt(repromptText)
        .getResponse();
    }
    let speechOutput = requestAttributes.t('HELP_UNHANDLED');
    const repromptText = speechOutput;
    
    return handlerInput.responseBuilder.speak(speechOutput).reprompt(repromptText).getResponse();
  },
};

const SessionEndedRequest = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const AnswerIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && (handlerInput.requestEnvelope.request.intent.name === 'AnswerIntent'
        || handlerInput.requestEnvelope.request.intent.name === 'DontKnowIntent');
  },
  handle(handlerInput) {
    if (handlerInput.requestEnvelope.request.intent.name === 'AnswerIntent') {
      return handleUserGuess(false, handlerInput);
    }
    return handleUserGuess(true, handlerInput);
  },
};

const RepeatIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.RepeatIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    let speechOutput = sessionAttributes.speechOutput;
    let repromptText = sessionAttributes.repromptText;

    return handlerInput.responseBuilder.speak(speechOutput)
      .reprompt(repromptText)
      .getResponse();
  },
};

const YesIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.YesIntent';
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    let speechOutput = sessionAttributes.speechOutput;
    let repromptText = sessionAttributes.repromptText;
    if (sessionAttributes.questions) {

      return handlerInput.responseBuilder.speak(speechOutput)
        .reprompt(repromptText)
        .getResponse();
    }
    return startGame(false, handlerInput);
  },
};

const StopIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
        && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    let speechOutput = requestAttributes.t('QUIT_MESSAGE');

    return handlerInput.responseBuilder.speak(speechOutput)
      .withShouldEndSession(true)
      .getResponse();
  },
};

const CancelIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    let speechOutput = requestAttributes.t('CANCEL_MESSAGE');

    return handlerInput.responseBuilder.speak(speechOutput)
      .getResponse();
  },
};

const NoIntent = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === 'IntentRequest'
      && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.NoIntent';
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    let speechOutput = requestAttributes.t('NO_MESSAGE');

    return handlerInput.responseBuilder.speak(speechOutput).getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);
    let speechOutput = '';
    if (INVALID_OPTION) {
        speechOutput = 'Opção inválida. Tente novamente.';
    } else {
        speechOutput = 'Desculpe, não consegui entender o que você disse. Tente novamente.';
    }
    const repromptText = speechOutput;

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(repromptText)
      .getResponse();
  },
};

const skillBuilder = Alexa.SkillBuilders.custom();
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequest,
    HelpIntent,
    AnswerIntent,
    RepeatIntent,
    YesIntent,
    StopIntent,
    CancelIntent,
    NoIntent,
    SessionEndedRequest,
    UnhandledIntent
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();
 
 
// =========================================================================================================================================
// TRANSLATION
// =========================================================================================================================================

const languageString = {
  'pt-BR': {
    translation: {
      QUESTIONS: questions.QUESTIONS_PT_BR,
      ASK_MESSAGE_START: 'Você deseja começar?',
      CANCEL_MESSAGE: 'Certo, nos vemos em breve',
      GAME_NAME: 'Partiu poupar',
      GAME_OVER_MESSAGE: 'Seu perfil de investidor é %s. ',
      HELP_MESSAGE: 'Eu vou perguntar %s questões de múltipla escolha. Responda com o número da resposta. Por exemplo, diga um, dois, três ou quatro. Para começar as perguntas, diga começar ou iniciar. ',
      HELP_REPROMPT: 'Para dar uma resposta para a pergunta, responda com o número da resposta.',
      HELP_UNHANDLED: 'Diga sim para continuar, ou não para pararmos por aqui.',
      NEW_GAME_MESSAGE: 'Bem vindo ao %s. ',
      NO_MESSAGE: 'Certo, continuamos outra hora, até logo.',
      PP_UNHANDLED: 'Tente dizer um número entre 1 e %s',
      QUIT_MESSAGE: 'Até mais.',
      REPEAT_QUESTION_MESSAGE: 'Para repetir a última pergunta, diga, repetir. ',
      START_UNHANDLED: 'Diga começar ou iniciar para começarmos uma nova rodada de perguntas.',
      STOP_MESSAGE: 'Você deseja continuar respondendo?',
      TELL_QUESTION_MESSAGE: 'Pergunta %s. %s ',
      WELCOME_MESSAGE: 'Vou te fazer %s perguntas, tente responder o máximo possível. Apenas diga o número da resposta. Vamos começar. ',
    },
  },
};
