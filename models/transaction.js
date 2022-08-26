const mongoose = require('mongoose');
const timestamps = require('mongoose-timestamp');
var uniqueValidator = require('mongoose-unique-validator');
const toJson = require('@meanie/mongoose-to-json');
const User = require('./user');
const Schema = mongoose.Schema;

const TransactionSchema = new Schema({
    from: { type: Schema.Types.ObjectId, ref: 'User'},
    to: { type: Schema.Types.ObjectId, ref: 'User'},
    post: { type: Schema.Types.ObjectId ,ref: 'Post' , default:null},
    message: { type: Schema.Types.ObjectId ,ref: 'Message' , default:null},
    fee : { type: Number, default: 0},
    type : { type: String},
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

TransactionSchema.statics.insertTransaction = function (param = {}) {
    let transaction = new this(param);
    return transaction.save();
}

TransactionSchema.statics.getTrans = function (from, to, userId, type){
    let con = {from: userId};
    if(type == 'income'){
        con = {to: userId};
    }
    return this.find(con).populate('from', 'avatar username _id fee')
        .populate('to' , 'avatar username _id fee')
        .populate('post' , '_id media type')
        .sort({'createdAt': -1})
        .skip(from)
        .limit(to)
        .lean()
        .exec();
}

TransactionSchema.statics.deleteTrans = function(userId, ids, type){
    let con = {from: userId};
    if(type == 'income'){
        con = {to: userId}
    }
    if (ids == 'all'){
        return this.find(con).remove().exec();
    }
    else{
        const ids_array = ids.split(",");
        con._id = { $in: ids_array}
        return this.find(con).remove().exec();
    }
}

TransactionSchema.index({ hashTags: 1 });
TransactionSchema.plugin(toJson);
TransactionSchema.plugin(uniqueValidator);
TransactionSchema.plugin(timestamps);
module.exports = mongoose.model('Transaction', TransactionSchema);
