const fs = require('fs');
const antimat = require('./antimat');
const QuickChart = require('quickchart-js');
const emojiRegex = require('emoji-regex');

let chatData = JSON.parse(fs.readFileSync('./result.json'));
let chatMsgs = chatData.messages;

let config = {
  "startDate": "*",
  "ignoreList": [],
  "ignoreDeletedUsers": false,
  "zoom": 1
}
if (!fs.existsSync("./config.json")) {
  fs.writeFileSync("./config.json", JSON.stringify(config))
}
config = JSON.parse(fs.readFileSync('./config.json'));

if (!fs.existsSync("./результаты")) {
  fs.mkdirSync("./результаты");
}

let msgStats = {}
let commonStatsByHours = {}

console.log("Анализ каждого сообщения и сбор данных...")

for (let i = 0; i < chatMsgs.length; i += 1) {
  let msg = chatMsgs[i];
  if (msg.type == "message") {

    if (msg.from == null) {
      if (config.ignoreDeletedUsers) continue;
      // присуждаем имени хотя бы userid, если был удален аккаунт
      msg.from = msg.from_id
    }
    if (config.startDate !== "*" && (Date.parse(msg.date) < Date.parse(config.startDate))) {
      continue;
    }

    let skeepMessageFromIgnoreList = false
    config.ignoreList.forEach((element) => {
      if (msg.from.includes(element)) skeepMessageFromIgnoreList = true;
    })
    if (skeepMessageFromIgnoreList) continue;

    let hoursStr = new Date(msg.date).getHours().toString()
    if (commonStatsByHours[hoursStr] == undefined) {
      commonStatsByHours[hoursStr] = 0;
    }
    commonStatsByHours[hoursStr]++;

    if (msgStats[msg.from] == undefined) {
      msgStats[msg.from] = {}
      msgStats[msg.from] = Object.assign(msgStats[msg.from], {
        counter: 0,
        voiceCounter: 0,
        stickerCounter: 0,
        textVolume: 0,
        videoCounter: 0,
        videoMessageCounter: 0,
        photoCounter: 0,
        emojiCounter: 0,
        statsByDaysOfWeek: {
          'Воскресенье': 0,
          'Понедельник': 0,
          "Вторник": 0,
          'Среда': 0,
          'Четверг': 0,
          'Пятница': 0,
          'Суббота': 0
        },
        matCounter: 0,
        statsByDays: {}
      });
    }
    msgStats[msg.from].counter++;
    msgStats[msg.from].statsByDaysOfWeek[Object.keys(msgStats[msg.from].statsByDaysOfWeek)[(new Date(msg.date)).getDay()]]++

    // важно перевести в локалку, иначе будет расхождение в день
    let strDate = new Date(msg.date).toLocaleDateString('en-CA').replaceAll("-", "/")
    if (msgStats[msg.from].statsByDays[strDate] == undefined) {
      msgStats[msg.from].statsByDays[strDate] = 0;
    }
    msgStats[msg.from].statsByDays[strDate]++;
    
    if (msg.media_type == "voice_message") {
      msgStats[msg.from].voiceCounter++;
    }
    if (msg.media_type == "sticker") {
      msgStats[msg.from].stickerCounter++;
    }
    if (msg.text && (typeof msg.text) == "string" && msg.text != "") {
      msgStats[msg.from].textVolume += msg.text.length;
      if (global.containsMat(msg.text)) {
        msgStats[msg.from].matCounter++
      }
      let regex = emojiRegex()
      for (const match of msg.text.matchAll(regex)) {
        const emoji = match[0];
        msgStats[msg.from].emojiCounter += [...emoji].length;
      }
    }
    if (msg.media_type == "video_file") {
      msgStats[msg.from].videoCounter++;
    }
    if (msg.media_type == "video_message") {
      msgStats[msg.from].videoMessageCounter++;
    }
    if (msg.photo) {
      msgStats[msg.from].photoCounter++;
    }
  }
}

console.log("Подготовка собранных данных для вывода...")

let statsDaysFromJoin = {}
let statsMsgsCounts = {}
let statsVoiceCounts = {}
let statsStickersCounts = {}
let statsAverageMsgLen = {}
let statsAverageSymbolsCountsInDay = {}
let statsPhotoCounts = {}
let statsVideoCounts = {}
let statsVideoMessageCounts = {}
let statsMatsCounts = {}
let statsEmojiCounts = {}
let statsByDaysForDisplay = []
let commonWeekStatsForDisplay = {}
let daysActivityForDisplay = {}


for (let i in msgStats) {
  statsByDaysForDisplay.push(
    {
      label: i,
      borderColor: random_rgba(),
      fill: false,
      data: remakeStatsByDaysForDisplay(msgStats[i].statsByDays)
    }
  )
  commonWeekStatsForDisplay[i] =
  {
    label: i,
    borderColor: random_rgba(),
    fill: false,
    data: Object.values(msgStats[i].statsByDaysOfWeek)
  };

  let user = msgStats[i]
  statsDaysFromJoin[i] = getNumberOfDays(new Date(Object.keys(msgStats[i].statsByDays)[0]), new Date(Object.keys(msgStats[i].statsByDays).at(-1))) || 1
  statsAverageSymbolsCountsInDay[i] = user.textVolume / statsDaysFromJoin[i]
  statsMsgsCounts[i] = user.counter
  statsEmojiCounts[i] = user.emojiCounter
  statsVoiceCounts[i] = user.voiceCounter
  statsStickersCounts[i] = user.stickerCounter
  statsAverageMsgLen[i] = user.textVolume / user.counter
  statsPhotoCounts[i] = user.photoCounter
  statsVideoCounts[i] = user.videoCounter
  statsVideoMessageCounts[i] = user.videoMessageCounter
  statsMatsCounts[i] = user.matCounter

  let randomColor = random_rgba();
  daysActivityForDisplay[i] =
  {
    label: i,
    data: [{
      x: statsDaysFromJoin[i],
      y: statsMsgsCounts[i]
    }],
    borderColor: randomColor,
    backgroundColor: randomColor,
    fill: false
  };
}



let startDate = Object.keys(msgStats[Object.keys(msgStats)[0]].statsByDays)[0] // дата первого соо у самого первого юзера из статистики
console.log("Вывод результатов от " + startDate + "...") 

const myChart = new QuickChart();
myChart.setBackgroundColor('white').setVersion("2").setWidth(500 * config.zoom).setHeight(500 * config.zoom);
myChart.setConfig(
  {
    "type": "line",
    "data": {
      "datasets": statsByDaysForDisplay
    },
    "options": {
      elements: {
        point: {
          radius: 0
        }
      },
      "scales": {
        "xAxes": [{
          "type": "time",
          "time": {
            "parser": "YYYY/MM/DD",
            min: startDate,
            unit: 'day'
          },
          "scaleLabel": {
            "display": true,
            "labelString": "дата"
          }
        }],
        "yAxes": [{
          "scaleLabel": {
            "display": true,
            "labelString": "сообщений"
          }
        }]
      }
    }
  }
)

myChart.toFile("./результаты/общая статистика.png")
myChart.setConfig(
  {
    type: 'line',
    data: {
      labels: [
        'Воскресенье',
        'Понедельник',
        'Вторник',
        'Среда',
        'Четверг',
        'Пятница',
        'Суббота'
      ],
      datasets: Object.values(commonWeekStatsForDisplay),
    },
  }
)
myChart.toFile("./результаты/недельная активность.png")
myChart.setConfig(
  {
    type: 'scatter',
    data: {
      datasets: Object.values(daysActivityForDisplay),
    },
    options: {
      title: {
        display: true,
        text: 'Присутствие в чате'
      },
      "scales": {
        "xAxes": [{
          "scaleLabel": {
            "display": true,
            "labelString": "дней в чате"
          }
        }],
        "yAxes": [{
          "scaleLabel": {
            "display": true,
            "labelString": "сообщений отправлено"
          }
        }]
      }
    }
  }
)
myChart.toFile("./результаты/присутствие.png")
myChart.setConfig(
  {
    type: 'line',
    data: {
      labels: Object.keys(commonStatsByHours),
      datasets: [
        {
          label: 'Часовая активность',
          data: Object.values(commonStatsByHours),
          fill: false,
        },
      ],
    },
  }
)
myChart.toFile("./результаты/часовая активность.png")

function makeHorizontalBar(data, name, description) {
  let sortedData = sortCollection(data)
  myChart.setConfig(
    {
      "type": "horizontalBar",
      "data": {
        "labels": Object.keys(sortedData),
        "datasets": [
          {
            "label": description,
            "data": Object.values(sortedData)
          },
        ]
      },
      "options": {
        "elements": {
          "rectangle": {
            "borderWidth": 2
          }
        },
        "responsive": true,
        "title": {
          "display": true
        },
        scales: {
          xAxes: [{
            ticks: {
              beginAtZero: true
            }
          }]
        }
      }
    }
  )
  myChart.toFile("./результаты/" + name + ".png")
}

makeHorizontalBar(statsVideoCounts, "видео", "Количество отправленных видеороликов")
makeHorizontalBar(statsVideoMessageCounts, "кружочки", "Количество отправленных кружочков (видеосообщений)")
makeHorizontalBar(statsPhotoCounts, "фото", "Количество отправленных фото")
makeHorizontalBar(statsStickersCounts, "стикеры", "Количество отправленных стикеров")
makeHorizontalBar(statsVoiceCounts, "голосовухи", "Количество отправленных голосовых сообщений")
makeHorizontalBar(statsMatsCounts, "маты", "Количество отправленных матов")
makeHorizontalBar(statsMsgsCounts, "всего сообщений", "Количество отправленных сообщений")
makeHorizontalBar(statsAverageMsgLen, "средняя длина", "Средняя длина сообщений")
makeHorizontalBar(statsDaysFromJoin, "дней в чате", "Разница в днях между первым и последним сообщением (присутствие в чате)")
makeHorizontalBar(statsAverageSymbolsCountsInDay, "символов в день", "Отправлено символов в среднем в день с даты первого и последнего сообщения")
makeHorizontalBar(statsEmojiCounts, "эмодзи", "Отправлено всего эмодзи")

function getNumberOfDays(start, end) {
  const date1 = new Date(start);
  const date2 = new Date(end);

  // One day in milliseconds 
  const oneDay = 1000 * 60 * 60 * 24;

  // Calculating the time difference between two dates 
  const diffInTime = date2.getTime() - date1.getTime();

  // Calculating the no. of days between two dates 
  const diffInDays = Math.round(diffInTime / oneDay);

  return diffInDays;
}

function random_rgba() {
  var o = Math.round, r = Math.random, s = 255;
  return 'rgba(' + o(r() * s) + ',' + o(r() * s) + ',' + o(r() * s) + ',' + 255 + ')';
}

function remakeStatsByDaysForDisplay(statsByDays) {
  let r = []
  for (let dayStats in statsByDays) {
    r.push(
      {
        x: dayStats,
        y: statsByDays[dayStats]
      }
    )
  }
  return r;
}

function sortCollection(c) {
  return Object.fromEntries(
    Object.entries(c).sort(([, a], [, b]) => b - a)
  );
}