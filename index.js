'use strict';

const Botkit = require('botkit');

const slackBotToken = process.env.SLACK_BOT_TOKEN;

if (!slackBotToken) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

const controller = Botkit.slackbot({
  debug: !!process.env.DEBUG
});

const bot = controller.spawn({
  token: slackBotToken
})

bot.startRTM(function(err, bot, payload) {
  if (err) {
    throw new Error('Could not connect to Slack');
  }
});

/*
   This KPI bot waits for you to call him. Here is sample usage.

   Format: @bot-name $from_date $to_date
     - from_date: Required. Start of time range of messages.
     - to_date:   Optional. End of time range of messages.
   Sample: @bot-name 2016/11/01 2016/11/31

   The bot gathers KPTs you posted from 2016/11/01 and 2016/11/31
   from history of a channel you called the bot.

   ```
   K
   - Started daily meeting
   - Find a release blocker earlier
   P
   - Cannot help each other...
   T
   - How about going lunch? :smile:
   ```
 */
controller.hears("(.+)",["direct_message","direct_mention","mention"], (bot, message) => {
  const [from_date, to_date] = message.match[0].split(' ');

  let params = {
    token: slackBotToken,
    channel: message.channel,
    oldest: (new Date(from_date) / 1000),
    count: 1000,
  }

  // `latest` is optional parameter, and its default value is `now`.
  if (to_date) {
    params.latest = new Date(to_date) / 1000
  }

  // https://api.slack.com/methods/channels.history
  bot.api.callAPI('users.list', params, (err, users) => {
    if (err) {
      throw new Error(`Slack API returns an error. error code: ${err}`);
    }

    // https://api.slack.com/methods/channels.history
    bot.api.callAPI('channels.history', params, (err, history) => {
      if (err) {
        throw new Error(`Slack API returns an error. error code: ${err}`);
      }

      let result = {
        k: [],
        p: [],
        t: [],
      }

      for (const message of history.messages) {
        const matched = message.text.match(/^([KkPpTt])\s+(.+)/);

        if (matched) {
          result[matched[1].toLowerCase()].push({
            content: matched[2],
            userId: message.user
          });
        }
      }

      const summary = `
K
${createSummary(result.k, users)}
P
${createSummary(result.p, users)}
T
${createSummary(result.t, users)}
`

      bot.reply(message, summary);
    });
  });
});

const createSummary = (elements, users) => {
  return elements.map(e => {
    const username = users.members.find(u => u.id == e.userId).name
    return `- ${e.content} by ${username}`
  }).join('\n')
}

