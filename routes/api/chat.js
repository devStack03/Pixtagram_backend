var express = require("express");
var utils = require('./../../helpers/utils');
var User = require('./../../models/user');
var Room = require('./../../models/room');
var Message = require('./../../models/message');
var Notification = require('./../../models/notification');
var Transaction = require('../../models/transaction');
var auth = require('./../../middlewares/auth')();
const nn_lib = require('./../../shared/constant');
const axios = require("axios");
const router = express.Router();

router.post('/getNotification',auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const from = req.body.from;
    const to = req.body.to;
    Notification.getAll(from,to,userId).then(async (noti) => {
        if (noti) {
            res.json(utils.getResponseResult(noti, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.get('/clearNotification', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    Notification.removeNotification(userId).then(async (noti) => {
        if (noti) {
            res.json(utils.getResponseResult(noti, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 0, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.post('/deleteNotification' , auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    Notification.updateNotification(userId).then(async (noti) => {
        if (noti) {
            res.json(utils.getResponseResult(noti, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 0, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.post('/createNewNotification',auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const msg = req.body.msg;

    Notification.createNewNotification(userId,msg).then(async (noti) => {
        if (noti) {
            res.json(utils.getResponseResult(noti, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 0, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.get('/getRooms', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];

    Room.getMyAllRooms(userId).then(async (room) => {
        if (room) {
            res.json(utils.getResponseResult(room, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.get('/getMessages/:room_id', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const roomId = req.params['room_id'];

    Message.getMessagesByRoomId(userId, roomId).then(async (messages) => {
        if (messages) {

            for (let msg of messages) {
                if (msg.from._id != userId && msg.status < 3) {
                    Message.setReadMessage(msg._id);
                }
            }

            res.json(utils.getResponseResult(messages, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.post('/getUnreadMessage',auth.authenticate(),(req,res,next) => {
    const userId = req.headers['user-id'];
    Message.getUnreadMsgCount(userId).then(async (count) => {
        res.json(utils.getResponseResult({msgCount: count}, 1, ''));
    }, ( err ) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
})

router.get('/getMessagesNew/:room_id', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const roomId = req.params['room_id'];
    let other_id = req.query['other_id'];

    let oid = [];
    if(roomId == 'new'){
        User.findUserById(other_id).then(async (u) => {
            res.json(utils.getResponseResult({dialog: [], contact: u}, 1, ''));
        },(err) =>{
            return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
        });
    }
    else{
        let roomName = '';
        let msg_id_list = [];
        Message.getMessagesByRoomId(userId, roomId).then(async (messages) => {
            if (messages && messages.length > 0) {
                for (let msg of messages) {
                    if (msg.from._id != userId && !msg.seen.includes(userId)) {
                        msg_id_list.push(msg._id);
                    }
                }
                if(msg_id_list.length > 0){
                    Message.setReadMessage(msg_id_list,userId);
                }
                oid = messages[0].room.group
                roomName = messages[0].room.name;
                res.json(utils.getResponseResult({dialog: messages, contact: oid, roomName: roomName}, 1, ''));

            }
            else if((!messages || messages.length == 0) && roomId != '') {
                let otherUser =  await Room.getRoom(roomId);
                let group = [];
                if (otherUser && otherUser.length > 0){
                    group = otherUser[0].group;
                }
                roomName = otherUser[0].name;
                res.json(utils.getResponseResult({dialog: [], contact: group, roomName: roomName}, 1, ''));
            }
            else {
                res.json(utils.getResponseResult({}, 1, ''));
            }
        }, (error) => {
            return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
        });
    }
});

router.get('/getRoom/:room_id', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const roomId = req.params['room_id'];

    Room.getRoom(roomId).then(async (room) => {
        if (room) {

            res.json(utils.getResponseResult({ room: room }, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
});

router.get('/chat-contacts', (req, res, next) => {
    // const userId = req.headers['user-id'];
    // const roomId = req.params['room_id'];
    //
    // Room.getRoom(roomId).then(async (room) => {
    //     if (room) {
    //
    //         res.json(utils.getResponseResult({ room: room }, 1, ''));
    //     } else {
    //         res.json(utils.getResponseResult({}, 1, ''));
    //     }
    // }, (error) => {
    //     return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    // });

    let r = [
        {
            id: '5725a680b3249760ea21de52', name: 'Alice Freeman', avatar: 'assets/images/avatars/alice.jpg', status: 'online', mood: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'},
            {id: '5725a680606588342058356d', name: 'Arnold', avatar: 'assets/images/avatars/Arnold.jpg', status: 'do-not-disturb', mood: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'},
             {id: '5725a680dcb077889f758961', name: 'Harper', avatar: 'assets/images/avatars/Harper.jpg', status: 'offline', mood: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'}
        ];
    res.json(utils.getResponseResult(r, 1, ''));
});

router.get('/chat-user',(req, res, next) => {
    let r = [
        {
            'id'      : '5725a6802d10e277a0f35724',
            'name'    : 'John Doe',
            'avatar'  : 'assets/images/avatars/profile.jpg',
            'status'  : 'online',
            'mood'    : 'it\'s a status....not your diary...',
            'chatList': [
                {
                    'id'             : '1725a680b3249760ea21de52',
                    'contactId'      : '5725a680b3249760ea21de52',
                    'name'           : 'Alice Freeman',
                    'unread'         : 4,
                    'lastMessage'    : 'You are the worst!',
                    'lastMessageTime': '2017-06-12T02:10:18.931Z'
                },
                {
                    'id'             : '2725a680b8d240c011dd2243',
                    'contactId'      : '5725a680b8d240c011dd224b',
                    'name'           : 'Josefina',
                    'unread'         : null,
                    'lastMessage'    : 'We are losing money! Quick!',
                    'lastMessageTime': '2017-02-18T10:30:18.931Z'
                },
                {
                    'id'             : '3725a6809413bf8a0a5272b4',
                    'contactId'      : '5725a6809413bf8a0a5272b1',
                    'name'           : 'Velazquez',
                    'unread'         : 2,
                    'lastMessage'    : 'Quickly come to the meeting room 1B, we have a big server issue',
                    'lastMessageTime': '2017-03-18T12:30:18.931Z'
                }
            ]
        }
    ];
    res.json(utils.getResponseResult(r, 1, ''));
});

router.get('/chat-chats',(req, res, next) => {
    // const userId = req.headers['user-id'];
    // const roomId = req.params['room_id'];
    //
    // Room.getRoom(roomId).then(async (room) => {
    //     if (room) {
    //
    //         res.json(utils.getResponseResult({ room: room }, 1, ''));
    //     } else {
    //         res.json(utils.getResponseResult({}, 1, ''));
    //     }
    // }, (error) => {
    //     return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    // });

    let r = [
        {
            'id'    : '1725a680b3249760ea21de52',
            'dialog': [
                {
                    'who'    : '5725a680b3249760ea21de52',
                    'message': 'Quickly come to the meeting room 1B, we have a big server issue',
                    'time'   : '2017-03-22T08:54:28.299Z'
                },
                {
                    'who'    : '5725a6802d10e277a0f35724',
                    'message': 'I’m having breakfast right now, can’t you wait for 10 minutes?',
                    'time'   : '2017-03-22T08:55:28.299Z'
                },
                {
                    'who'    : '5725a680b3249760ea21de52',
                    'message': 'We are losing money! Quick!',
                    'time'   : '2017-03-22T09:00:28.299Z'
                },
                {
                    'who'    : '5725a6802d10e277a0f35724',
                    'message': 'It’s not my money, you know. I will eat my breakfast and then I will come to the meeting room.',
                    'time'   : '2017-03-22T09:02:28.299Z'
                },
                {
                    'who'    : '5725a680b3249760ea21de52',
                    'message': 'You are the worst!',
                    'time'   : '2017-03-22T09:05:28.299Z'
                },
                {
                    'who'    : '5725a680b3249760ea21de52',
                    'message': 'We are losing money! Quick!',
                    'time'   : '2017-03-22T09:15:28.299Z'
                },
                {
                    'who'    : '5725a6802d10e277a0f35724',
                    'message': 'It’s not my money, you know. I will eat my breakfast and then I will come to the meeting room.',
                    'time'   : '2017-03-22T09:20:28.299Z'
                },
                {
                    'who'    : '5725a680b3249760ea21de52',
                    'message': 'You are the worst!',
                    'time'   : '2017-03-22T09:22:28.299Z'
                },
                {
                    'who'    : '5725a680b3249760ea21de52',
                    'message': 'We are losing money! Quick!',
                    'time'   : '2017-03-22T09:25:28.299Z'
                },
                {
                    'who'    : '5725a6802d10e277a0f35724',
                    'message': 'It’s not my money, you know. I will eat my breakfast and then I will come to the meeting room.',
                    'time'   : '2017-03-22T09:27:28.299Z'
                },
                {
                    'who'    : '5725a680b3249760ea21de52',
                    'message': 'You are the worst!',
                    'time'   : '2017-03-22T09:33:28.299Z'
                },
                {
                    'who'    : '5725a680b3249760ea21de52',
                    'message': 'We are losing money! Quick!',
                    'time'   : '2017-03-22T09:35:28.299Z'
                },
                {
                    'who'    : '5725a6802d10e277a0f35724',
                    'message': 'It’s not my money, you know. I will eat my breakfast and then I will come to the meeting room.',
                    'time'   : '2017-03-22T09:45:28.299Z'
                },
                {
                    'who'    : '5725a680b3249760ea21de52',
                    'message': 'You are the worst!',
                    'time'   : '2017-03-22T10:00:28.299Z'
                }
            ]
        },
        {
            'id'    : '2725a680b8d240c011dd2243',
            'dialog': [
                {
                    'who'    : '5725a680b8d240c011dd224b',
                    'message': 'Quickly come to the meeting room 1B, we have a big server issue',
                    'time'   : '2017-04-22T01:00:00.299Z'
                },
                {
                    'who'    : '5725a6802d10e277a0f35724',
                    'message': 'I’m having breakfast right now, can’t you wait for 10 minutes?',
                    'time'   : '2017-04-22T01:05:00.299Z'
                },
                {
                    'who'    : '5725a680b8d240c011dd224b',
                    'message': 'We are losing money! Quick!',
                    'time'   : '2017-04-22T01:10:00.299Z'
                }
            ]
        },
        {
            'id'    : '3725a6809413bf8a0a5272b4',
            'dialog': [
                {
                    'who'    : '5725a6809413bf8a0a5272b1',
                    'message': 'Quickly come to the meeting room 1B, we have a big server issue',
                    'time'   : '2017-04-22T02:10:00.299Z'
                }
            ]
        }
    ];

    res.json(utils.getResponseResult(r, 1, ''));
});

router.post('/removeChat', auth.authenticate(), (req, res, next) => {
    const roomId = req.body.roomId;
    Room.deleteRoom(roomId).then( () =>{
        Message.deleteMessageByRoomId(roomId);
        res.json(utils.getResponseResult(1, 1, ''));
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });
    res.json(utils.getResponseResult(0, 1, ''));
});

router.post('/testChat', auth.authenticate() , (req, res, next) => {
    const userId = req.headers['user-id'];
    const searchText = req.body.searchText;
    Room.getRooms(userId, 0, 40, searchText).then( async (data) =>{
        rooms = JSON.parse(JSON.stringify(data));
        if (rooms) {

            for (let room of rooms) {

                if(room){
                    room.hasNewMsg = false;

                    let lastSeenDate = room.createdAt;
                    if (room.participant1 == userId) {
                        lastSeenDate = room.lastSeenDateOfPart1;
                    } else {
                        // lastSeenDate = room..lastSeenDateOfPart2;
                        let current_user = room.lastSeenDateOfPart2.filter((item) => {
                            if(item.id == userId) {
                                return item;
                            }
                        });
                        if(current_user.length > 0) {
                            lastSeenDate = current_user[0].seenDate;
                        }
                    }

                    let roomMsgs = await Message.getNewReceivedMessages(userId, room.id, lastSeenDate);
                    if (roomMsgs.length) {
                        room.hasNewMsg = roomMsgs.length;
                    }
                }
            }

            res.json(utils.getResponseResult(rooms, 1, ''));
        }
        // res.json(utils.getResponseResult(data, 1, ''));
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, error));
    });
    //res.json(utils.getResponseResult(0, 1, ''));
});

router.post('/getRoomswithScroll', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    var start = req.body.start;
    var count = req.body.count;
    Room.getRooms(userId, start, count).then(async (rooms) => {
        rooms = JSON.parse(JSON.stringify(rooms));

        if (rooms) {

            for (let room of rooms) {

                room.hasNewMsg = false;

                let lastSeenDate;
                if (room.participant1._id == userId) {
                    lastSeenDate = room.lastSeenDateOfPart1;
                } else {
                    lastSeenDate = room.lastSeenDateOfPart2;
                }

                let roomMsgs = await Message.getNewReceivedMessages(userId, room.id, lastSeenDate);
                if (roomMsgs.length) {
                    room.hasNewMsg = roomMsgs.length;
                }
            }

            res.json(utils.getResponseResult(rooms, 1, ''));
        } else {
            res.json(utils.getResponseResult({}, 1, ''));
        }
    }, (error) => {
        return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
    });

});

router.post('/createRoom', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    let usrs = req.body.usrs;
    let roomId = req.body.roomId;
    let remove = req.body.remove;
    let uid = [];
    let removed_flag = false;
    if(!remove){
        removed_flag = true;
        if(!usrs || usrs.length == 0) {
            res.json(utils.getResponseResult({}, 0, 'Users Not Found'));
        }
        for(let user of usrs){
            uid.push(user._id);
        }
    }
    if(roomId) {
        Room.checkRoomExist(userId, uid, roomId).then(async (room) => {
            try{
                if(room) {
                    let group = room.group ? room.group : [];
                    for(var i in group){
                        group[i] = group[i].toString();
                    }
                    if(!remove) {
                        group = group.concat(uid);
                        group = [...new Set(group)];
                    }
                    else{
                        var index = group.indexOf(remove);
                        if (index !== -1) {
                            group.splice(index, 1);
                        }
                    }

                    const updatedRoom = await Room.updateRoomById(roomId , {group: group});
                    let selectedRoom = await Room.getRoom(roomId);
                    const g = selectedRoom && selectedRoom[0] && selectedRoom[0].group ? selectedRoom[0].group: [];
                    selectedRoom = selectedRoom && selectedRoom[0]? selectedRoom[0] : {};
                    res.json(utils.getResponseResult({code: 0, room_id: updatedRoom._id.toString(), group:g, removed_flag: removed_flag, room: selectedRoom}, 1, ''));
                }
                else{
                    res.json(utils.getResponseResult({}, 0, 'The room not exist'));
                }
            }catch(err){
                return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
            }
        })
    }
    else {
        Room.checkRoomExist(userId, uid).then(async (room) => {
            try{
                if (room) {
                    res.json(utils.getResponseResult({}, 0, 'The room already exists'));
                }
                else {
                    room = await Room.createRoom(userId, uid);
                    const selectedRoom = await Room.getRoom(room._id);
                    const g = selectedRoom && selectedRoom[0] && selectedRoom[0].group ? selectedRoom[0].group: [];
                    res.json(utils.getResponseResult({code: 1, room: room, room_id: room._id.toString(), group:g, removed_flag: removed_flag}, 1, ''));
                }
            }catch(err){
                return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
            }
        })
    }
})

// router.post('chat-chats',)

router.post('/', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    var receiver = req.body.to;
    var message = req.body.message;
    var message_type = req.body.message_type;
    var media = req.body.media;
    var room = req.body.room;
    var postMediaFee = req.body.postMediaFee
    let token = [];
    if(!postMediaFee) {
        postMediaFee = 0;
    }
    Room.checkRoomExist(userId, receiver,room).then(async (room) => {

        try {
            if (room) {
                room = await Room.updateRoom(room._id, room.participant1._id == userId ? true : false, message, message_type, userId);
                if(room.participant1 && room.participant1.fcm_token && room.participant1._id != userId) {
                    token.push(room.participant1.fcm_token);
                }
                if(room.group) {
                    for(let g of room.group) {
                        if(g._id == userId || !g.fcm_token) continue;
                        token.push(g.fcm_token);
                    }
                }
            }
            else {
                res.json(utils.getResponseResult({}, 0, 'The room has been deleted by manager.'));
            }

            Message.createNewMessage(userId, receiver, room._id, message, media, message_type, postMediaFee).then((msg) => {

                msg = JSON.parse(JSON.stringify(msg));
                if(token.length > 0) {
                    try{
                        const r = axios.post('https://fcm.googleapis.com/fcm/send', {
                                notification:{
                                    title: "Message reached",
                                    body: message,
                                    data: req.body
                                },
                                registration_ids: token
                            },
                            {
                                headers: {
                                    'Authorization': 'key=AAAAxj55818:APA91bFBXso88Y6tX-yC4xHgnAdrXbghBUbntyseuWmhAXrG6CsDhJBgYpkA4mHCV8_LVQtpk9xEryILBRlotrdI_YbrkC8MWlsBJ9kYvHDWpIAKeyODb0znohEvtB942QKHUVACpNq9',
                                    'Content-Type': 'application/json'
                                }
                            });
                        r.then(function(response){

                        }).catch(function(err){

                        })
                    }catch(err_token){
                        console.log(err_token)
                    }
                }
                if (msg) {
                    msg.isSendTo = true;
                    res.json(utils.getResponseResult(msg, 1, ''));
                } else {
                    res.json(utils.getResponseResult({}, 1, ''));
                }

            }, (error) => {
                return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
            });

        } catch (err) {
            return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
        }
    });
});

router.post('/transferBalance',auth.authenticate(), async (req,res,next) => {
    const userId = req.headers['user-id'];
    const param = req.body;
    var credit_id = '';
    var credit_key = '';
    var id = '';
    var credit_id1 = '';
    var credit_key1 = '';

    const message=  await Message.findById(param.messageId);
    if(userId && message && message.from.toString() != userId && message.postMediaFee && message.postMediaFee > 0 && (!message.purchaseList || !message.purchaseList.includes(userId))){
        const user =await User.getUsersByMultiple([userId,message.from]);
        if (!user || user.length < 2) return res.status(404).json(utils.getResponseResult({}, 0, "User not found"));
        for(const u of user){
            if(u._id == userId){
                credit_id = u.o_auth ? u.o_auth.nn_network ? u.o_auth.nn_network.credit_id ? u.o_auth.nn_network.credit_id : '':'':'';
                credit_key = u.o_auth ? u.o_auth.nn_network ? u.o_auth.nn_network.credit_key ? u.o_auth.nn_network.credit_key : '':'':'';
                id = u.o_auth ? u.o_auth.nn_network ? u.o_auth.nn_network.id ? u.o_auth.nn_network.id : '':'':'';
            }
            if(u._id == message.from.toString()){
                email = u.email;
                credit_id1 = u.o_auth ? u.o_auth.nn_network ? u.o_auth.nn_network.credit_id ? u.o_auth.nn_network.credit_id : '':'':'';
                credit_key1 = u.o_auth ? u.o_auth.nn_network ? u.o_auth.nn_network.credit_key ? u.o_auth.nn_network.credit_key : '':'':'';
            }
        }
        if (!credit_id && !credit_key && !id) {
            return res.status(200).json(utils.getResponseResult({}, 0, "You're not a NN member"));
        }
        else if(!credit_id1){
            return res.status(200).json(utils.getResponseResult({}, 0, "The user that you send is not a NN member"));
        }
        else{
            let current_timestamp = parseInt(Date.now() / 1000);
            const hashHma1 = utils.getHashHma(nn_lib.clientId,current_timestamp);
            const hashHma2 = utils.getHashHma(credit_key,current_timestamp);
            let comment = '';
            if(message.type == 2){
                comment= "Received for viewing of image " + message.media;
            }
            else{
                comment= "Received for viewing of video " + message.media;
            }
            try{
                const r = await axios.post(nn_lib.nnbalance + credit_id + '/send',{
                    ToAccountId: credit_id1,
                    Amount: message.postMediaFee,
                    Comment: comment
                },{
                    headers:{
                        'X-ApiKey': nn_lib.x_api,
                        'X-ApiKeyValidation': current_timestamp + '|' + hashHma1,
                        'X-Validation': current_timestamp + '|' + hashHma2
                    }
                });
                if(r.status == 200 && r.data && r.data.Data.FromBalance){
                    const purchaseNew = await Message.insertPurchase(message._id,userId);
                    if(purchaseNew){
                        const transaction = await Transaction.insertTransaction({
                            from:userId,
                            to:message.from,
                            message:message.id,
                            fee:message.postMediaFee,
                            type:'message'
                        });
                        let buyer = '';
                        // if(purchaseNew && purchaseNew.buyer && purchaseNew.buyer.username) {
                        //     buyer = purchaseNew.buyer.username;
                        // }
                        // let message = "<div style='text-align:left;font-family:Helvetica,Arial,sans-serif;font-size:20px;color:#5f5f5f;line-height:135%;margin-top:0;margin-bottom:20px'>";
                        // message += '<a href="https://' + req.get('host') + '/users/'+userId + '" target="_blank">'+buyer+'</a>';
                        // message += ' viewed ' + '<a href="https://'+req.get('host') + '/view-post/' + postId + '" target="_blank">your post</a>';
                        // message += ' for ' + postFee + ' nudles.';
                        // if(purchaseNew.post.media && purchaseNew.post.type == 2){
                        //     message += "<div><img src='"+purchaseNew.post.media+"' style='max-width:620px;width:100%;margin-top:20px;margin-bottom:20px;display:block'/></div>";
                        // }
                        // message +="</div>";
                        // mail.sendGridSendMail(purchaseNew.post.owner.email,'Post View',message,function(err,data){
                        //
                        // });
                        return res.status(200).json(utils.getResponseResult({balance: r.data.Data.FromBalance}, 1, ''));
                    }
                    else{
                        return res.status(200).json(utils.getResponseResult({code: 2}, 0, 'Database Failure'));
                    }
                }
            }catch(e){
                return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
            }
        }
    }
    else{
        return res.status(500).json(utils.getResponseResult({}, 0, 'Error'));
    }
});

router.post('/updateRoom',auth.authenticate(), (req,res,next) => {
    const userId = req.headers['user-id'];
    const param = req.body;
    const id = param['id'];
    delete param.id;
    Room.updateRoomById(id,param).then(async (room) => {
        try{
            res.json(utils.getResponseResult({}, 1, ''));
        }
        catch(err){
            return res.status(500).json(utils.getResponseResult({}, 0, 'Database error'));
        }
    });
});

router.get('/testtest',(req,res,next)=>{
    let otherUser = '';
    Message.getMessagesByRoomId('613bc0c0dd36f30c2c4bea20', '6170fd7a4ff183209c23d1d3').then(async (messages) => {
        if (messages) {
            res.json(utils.getResponseResult({dialog: messages, contact: otherUser}, 1, ''));
        }else{
            res.json(utils.getResponseResult({}, 1, ''));
        }
    });
});

router.delete('/:id', auth.authenticate(), (req, res, next) => {
    const userId = req.headers['user-id'];
    const postId = req.params.id;
});

module.exports = router;
