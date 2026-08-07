"use strict";


const mineflayer = require("mineflayer");
const express = require("express");
const https = require("https");

const config = require("./settings.json");
const {addLog,getLogs}=require("./logger");


let bot=null;

let connected=false;

let reconnectAttempts=0;

let reconnectTimer=null;



// =============================
// Render Web Server
// =============================


const app=express();

const PORT=process.env.PORT || 5000;


app.get("/",(req,res)=>{

res.json({

bot:config.name,

status:
connected?
"online":
"offline",

server:
config.server.ip,

uptime:
Math.floor(process.uptime())

});

});



app.get("/health",(req,res)=>{

res.json({

status:
connected?
"connected":
"disconnected",

players:
bot?.players?
Object.keys(bot.players).length:
0,

position:
bot?.entity?
bot.entity.position:
null

});

});



app.get("/logs",(req,res)=>{

res.json(getLogs());

});



app.listen(PORT,"0.0.0.0",()=>{

addLog(
`HTTP server running on ${PORT}`
);

});



// =============================
// Render Keep Alive
// =============================


function keepAlive(){


const url=
process.env.RENDER_EXTERNAL_URL;


if(!url){

addLog(
"Render URL missing - keep alive disabled"
);

return;

}


setInterval(()=>{


https.get(
`${url}/health`,
()=>{}
)
.on(
"error",
()=>{}
);


},600000);


}


keepAlive();




// =============================
// Bot Creation
// =============================


function createBot(){


if(bot){

try{
bot.quit();
}catch{}

bot=null;

}



addLog(
"Connecting bot..."
);



bot=mineflayer.createBot({

username:
config["bot-account"].username,

password:
config["bot-account"].password || undefined,


auth:
config["bot-account"].type,


host:
config.server.ip,


port:
config.server.port,


version:
config.server.version

});





bot.once("spawn",()=>{


connected=true;

reconnectAttempts=0;


addLog(
`Connected successfully (${bot.version})`
);



startAntiAFK();



if(config.utils["auto-auth"].enabled){

setTimeout(()=>{

bot.chat(
`/login ${config.utils["auto-auth"].password}`
);


},5000);


}



});





bot.on("kicked",(reason)=>{


addLog(
"Kicked: "+reason
);


connected=false;


});





bot.on("end",()=>{


connected=false;


addLog(
"Disconnected"
);


scheduleReconnect();


});





bot.on("error",(err)=>{


addLog(
"Error: "+err.message
);


});



}






// =============================
// Reconnect System
// =============================


function scheduleReconnect(){


if(reconnectTimer)
return;


if(!config.utils["auto-reconnect"])
return;



reconnectAttempts++;


let delay=Math.min(

15000 *
reconnectAttempts,

120000

);



addLog(
`Reconnect in ${delay/1000}s`
);



reconnectTimer=setTimeout(()=>{


reconnectTimer=null;


createBot();



},delay);



}




// =============================
// Anti AFK
// =============================


function startAntiAFK(){


if(!config.utils["anti-afk"])
return;



setInterval(()=>{


if(!bot||!connected)
return;



try{


bot.swingArm();


}
catch{}



},30000);




setInterval(()=>{


if(!bot||!connected)
return;



try{


bot.setControlState(
"jump",
true
);



setTimeout(()=>{


bot.setControlState(
"jump",
false
);



},300);



}
catch{}



},120000);



}






// =============================
// Crash Protection
// =============================


process.on(
"uncaughtException",
err=>{


addLog(
"Crash recovered: "+err.message
);


connected=false;


scheduleReconnect();


});



process.on(
"unhandledRejection",
err=>{


addLog(
"Promise error: "+err
);


});




// START


addLog("====================");

addLog(
`${config.name} starting`
);


createBot();
