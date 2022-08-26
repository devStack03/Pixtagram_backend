const express=  require('express');
const app = express();
const cors = require('cors')
const http = require('http');
const socketIO = require('socket.io')
const https = require('https')
var fs = require('fs');
const axios = require('axios');
var cron = require('node-cron');
const nn_lib = require('../shared/constant');
var utils = require('../helpers/utils');
let users = [];
var options = {
    key: fs.readFileSync('./Pixstagam-ssl/privkey.pem'),
    cert: fs.readFileSync('./Pixstagam-ssl/cert.pem'),
    ca: fs.readFileSync('./Pixstagam-ssl/chain.pem'),
};

const server = https.createServer(options,app) /* https socket server->SSL */
// const server = http.createServer(app); /* http socket server */
const io = socketIO(server, {
    cors: {
        origin: '*',
    }
});
const port  = 8282;

io.on('connection',  (socket) => {
    socket.on('connecting', (arg) => {
        if(arg != null && arg.trim() != ''){
            let user = users.filter( usr => usr.uid == arg);
            if(user.length == 0){
                users.push({uid: arg, sid:socket.id})
            }
        }
    })
    socket.on('leave-room' , (arg) => {
        socket.leave(arg.room)
        socket.rooms = {}
    })

    socket.on('newpost', (arg) => {
        socket.broadcast.emit('newpost' , arg)
    })

    socket.on('likepost' , (arg) => {
        socket.broadcast.emit('likepost' , arg)
    })
    socket.on('likeComment' , (arg) => {
        socket.broadcast.emit('likeComment' , arg)
    })
    socket.on('remove-room' , (arg) => {
        socket.broadcast.emit('remove-room' , arg)
    })
    socket.on('bookmark' , (arg) => {
        socket.broadcast.emit('bookmark' , arg)
    })
    socket.on('comment' , (arg) => {
        socket.broadcast.emit('comment' , arg)
    })

    socket.on('webpush', (arg) => {
        io.emit('webpush', arg);
    })
    socket.on('new-message', (arg) => {
        socket.broadcast.to(arg.msg.room).emit('new-message',arg.msg)

        let  item = arg.msg;
        if(item && item.uids){
            // let user = users.filter( usr => usr.uid == item.to);
            // if(user && user[0]){
            //     io.to(user[0].sid).emit('new-msg',item)
            // }
            for (const uid of item.uids) {
                let user = users.filter( usr => {
                    if (usr.uid == uid){
                        return usr;
                    }
                });
                if(user && user[0]){
                    io.to(user[0].sid).emit('new-msg',item)
                }
            }
        }
    })
    socket.on('typing', (arg) => {
        socket.broadcast.to(arg.msg.room).emit('typing' , arg.typing)

    })
    socket.on('join-room', (arg) => {
        if(socket.rooms.toString().indexOf(arg.room) >= 0) {

        }
        else{

            socket.join(arg.room)
        }

    })
    socket.on('disconnect', function(){
        users = users.filter(item => item.sid != socket.id)
    })

})

server. listen(port , () => {
    console.log('server is listening in port 8282')
})

cron.schedule('1 30 * * * *', async () => {
    const  response = await axios.get('https://newbiefans.com/api/user/setFollowUsers');
    if(response.data && response.data.data.length > 0){
        for(const inv of response.data.data){
            if(inv.followee.followFee > 0){
                var credit_id = '';
                var credit_key = '';
                var id = '';
                var credit_id1 = '';
                var credit_key1 = '';
                credit_id = inv.follower.o_auth ? inv.follower.o_auth.nn_network ? inv.follower.o_auth.nn_network.credit_id ? inv.follower.o_auth.nn_network.credit_id : '':'':'';
                credit_key = inv.follower.o_auth ? inv.follower.o_auth.nn_network ? inv.follower.o_auth.nn_network.credit_key ? inv.follower.o_auth.nn_network.credit_key : '':'':'';
                id = inv.follower.o_auth ? inv.follower.o_auth.nn_network ? inv.follower.o_auth.nn_network.id ? inv.follower.o_auth.nn_network.id : '':'':'';
                credit_id1 = inv.followee.o_auth ? inv.followee.o_auth.nn_network ? inv.followee.o_auth.nn_network.credit_id ? inv.followee.o_auth.nn_network.credit_id : '':'':'';
                credit_key1 = inv.followee.o_auth ? inv.followee.o_auth.nn_network ? inv.followee.o_auth.nn_network.credit_key ? inv.followee.o_auth.nn_network.credit_key : '':'':'';

                if(credit_id && credit_key && id && credit_id1 && credit_key1){
                    let current_timestamp = parseInt(Date.now() / 1000);
                    const hashHma1 = utils.getHashHma(nn_lib.clientId,current_timestamp);
                    const hashHma2 = utils.getHashHma(credit_key,current_timestamp);
                    try{
                        const r = await axios.post(nn_lib.nnbalance + credit_id + '/send',{
                            ToAccountId: credit_id1,
                            Amount: inv.followee.followFee,
                            Comment: "Paid to Followee"
                        },{
                            headers:{
                                'X-ApiKey': nn_lib.x_api,
                                'X-ApiKeyValidation': current_timestamp + '|' + hashHma1,
                                'X-Validation': current_timestamp + '|' + hashHma2
                            }
                        });
                        if(r.status == 200 && r.data && r.data.Data.FromBalance){
                            axios.post('https://newbiefans.com/api/user/updateFollowUsers',
                                {  follower: inv.follower._id,
                                        followee: inv.followee._id,
                                        fee:inv.followee.followFee
                                })
                        }

                    }catch(e){
                        console.log(e)
                    }
                }
            }
        }
    }
});
