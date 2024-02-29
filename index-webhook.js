#!/usr/bin/env node
// nohup nodejs index-webhook.js &
const {Telegraf, Markup} = require('telegraf');
const {Pool} = require('pg')
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const request = require('request');

const statement = {};
require('dotenv').config();
const bot = new Telegraf(process.env.TOKEN)

//const {API, YMPaymentFromBuilder} = require('yoomoney-sdk');
//const api = new API(process.env.YOOMONEY_TOKEN);
// let res = new YMPaymentFromBuilder({
//     quickPayForm: "shop",
//     sum: (300 * 74.3).toFixed(2),

//     // Делаем перенаправление, чтобы пользователь вернулся в магазин
//     // после покупки, обрабатываем на 48 строке
//     successURL: `http://t.me/legion_corp_bot`,

//     // Просим деньги с карты, можно передать просто строку "AC"
//     paymentType: "AC",

//     // Номер кошелька получателя (ваш)
//     receiver: "4100118548648067",

//     // Добавляем метку, чтобы потом вычленить в уведомлении
//     label: "payment-001",

//     comment: "За ♂️Fisting♂️"
// })

// console.log(res.buildHtml())

const https = require('https')

const data = JSON.stringify({
    "receiver": "4100118548648067", 
    "quickpay-form":"buttom", 
    "paymentType": "AC", 
    "sum": 1000,
    "successURL": "https://t.me/legion_corp_bot"
})

const options = {
  hostname: 'yoomoney.ru',
  port: 443,
  path: '/quickpay/confirm',
  method: 'POST',
  key:  fs.readFileSync('/etc/ssl/legion-corp/private.key'),
  cert: fs.readFileSync('/etc/ssl/legion-corp/legion-corp.crt'),
  ca:   fs.readFileSync('/etc/ssl/legion-corp/chain.crt'),
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    
    'Content-Length': data.length
  }
}

const req = https.request(options, (res) => {
  console.log(`statusCode: ${res.statusCode}`)

  res.on('data', (d) => {
    process.stdout.write(d)
  })
})

req.on('error', (error) => {
  console.error(error)
})

req.write(data)
req.end()

// request.post('https://yoomoney.ru/quickpay/confirm', {
//     "receiver": "4100118548648067", 
//     "quickpay-form":"shop", 
//     "paymentType": "AC", 
//     "sum": 1000,
//     "successURL": "https://t.me/legion_corp_bot"
// }, response => console.log(response.data))

const freeekasssaGetUrlPayment = (chat_id, amount) => {
    let hash = [
        process.env.FK_MERCHANT_ID, 
        amount,
        process.env.FK_FIRST_SECRET, 
        'RUB', chat_id
        
    ].join(':');

    let queryPay1Mounth = {
        m: process.env.FK_MERCHANT_ID,
        oa: amount,
        currency: 'RUB',
        o: chat_id,
        s: crypto.createHash('md5').update(hash).digest("hex")
    }
    return 'https://pay.freekassa.ru/?' + Object.entries(queryPay1Mounth).map(value => value.join('=')).join('&')
}
const addItemRowPGUserCerts = async (chat_id, cert) => {
    config = {
        host: 'localhost',
        user: 'openvpn',
        database: 'opevpn',
        password: 'password',
        port: 5432
      };

    const pool = new Pool(config);
    const now = new Date()
    await pool.query('INSERT INTO users_and_certs (user_id, cert_name, created_at, date) \
    VALUES ($1, $2, $3, $4)', [chat_id, cert, now, now])
    .then(response => response.rows);
}

const checkUsersConfigs = async chat_id => {
    config = {
        host: 'localhost',
        user: 'openvpn',
        database: 'opevpn',
        password: 'password',
        port: 5432
      };

    const pool = new Pool(config);

    let {rows} = await pool.query('SELECT cert_name FROM users_and_certs WHERE user_id=$1', [chat_id])
    if (rows) return rows[0].cert_name;
    return;
}

const downloadConfigFromServer = config => {
    const file = fs.createWriteStream("config.ovpn");
    const request = http.get("http://213.171.5.202:8080/cxhm8u67jr8ytc/"+config, response => 
    {
        response.pipe(file);

        // after download completed close filestream
        file.on("finish", () => file.close());
    });

    return true;
}

const createConfigOnServer = (callback, host="213.171.5.202", port=8080) => {
    http.get({ 
        host: host, port: port,
        path: '/create-config',
        headers: {
            "Content-Type": 'application/json',
            accept: "application/json"
        }}, resp => {
            let data = "";
            resp.on('data', chunk => data += chunk);
            resp.on('end', () => {
                callback(data)
            })
        })
}

const sendConfig = async ctx => {
    await ctx.telegram.sendDocument('./config.ovpn');
    fs.unlink('config.ovpn', err => {
        if (err) throw err;
        })
}

bot.action('pay:1mounth', (ctx) => {
    let url, now = new Date();
    if (statement[ctx.from.id]?.form_pay && 
        statement[ctx.from.id]?.created_at && 
        now - statement[ctx.from.id]?.created_at <= 360000
    ) {

        url = statement[ctx.from.id].form_pay
        statement[ctx.from.id].created_at = new Date();
        
    } else {
        url = freeekasssaGetUrlPayment(ctx.from.id, process.env.VPN_1MOUNTH)
        statement[ctx.from.id] = {form_pay: url, created_at: new Date(), amount: process.env.VPN_1MOUNTH};  // Нужно сделать не перезапись объекта, а дополнение ключей
    }



    return ctx.editMessageText('Ваш URL для оплаты на 1 месяц '+url, {
        reply_markup: {
            inline_keyboard: [
                [{text: 'Ссылка на оплату', url: url}],
                [{text: 'Проверить оплату', callback_data: 'check:pay'}]
            ]
        }
    })
})


bot.start(ctx => ctx.telegram.sendMessage(ctx.from.id, 'Приветствуем в нашем боте, здесь вы можете приобрести конфиг openvpn.', {
                reply_markup: {
                    inline_keyboard: [[{text: '1 Месяц', callback_data: 'pay:1mounth'}]]
                }
            }) 
    //{
       //  let cuc = checkUsersConfigs(ctx.from.id)
       // if (cuc) {
       //     downloadConfigFromServer(cuc)
       //     ctx.telegram.sendMessage(ctx.from.id, 
       //         'Вы уже приобрели конфиг openvpn.', {
       //             reply_markup: {
       //                 inline_keyboard: [[{text: 'Проверить срок', callback_data: 'check:config'}]]
       //             }
       //         })
       //     sendConfig(ctx);
       //     return;

       // }
        
//	return ctx.telegram.sendMessage(
//            ctx.from.id,
//            'Приветствуем в нашем боте, здесь вы можете приобрести конфиг openvpn.',
//            {
//                reply_markup: {
//                    inline_keyboard: [[{text: '1 Месяц', callback_data: 'pay:1mounth'}]]
 //               }
   //         })

   // }    
)

bot.on('message', (ctx) => {
    ctx.telegram.deleteMessage(ctx.from.id, ctx.message.message_id )
});

bot.telegram.setWebhook(process.env.WEBHOOK_URL)

const app = express()
app.use(express.json())
app.use(bot.webhookCallback('/telegram'))
app.get('/', (req, res) => res.send('Hello World!'));

// FreeKassa Api
app.post('/success-freeekasssa', (request, response) => {
    return response.status(200).end();
})

app.post('/reject-freeekasssa', (request, response) => {
    return response.status(200).end();
})

app.post('/notification-freeekasssa', (request, response) => {
    console.log(request.body)
    return response.status(200).end();
})

// Telegram WebHook api
app.post('/telegram', (request, response) => {
    return bot.handleUpdate(request.body, response)
})


app.listen(3001, () => console.log('\n  [*] WebHook Telegraf -> http://213.171.5.202:3001/telegram'))
