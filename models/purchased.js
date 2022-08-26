const mongoose = require('mongoose');
const timestamps = require('mongoose-timestamp');
var uniqueValidator = require('mongoose-unique-validator');
const toJson = require('@meanie/mongoose-to-json');
var findHashtags = require('find-hashtags');
const Schema = mongoose.Schema;

const PurchasedSchema = new Schema({
    buyer: { type: Schema.Types.ObjectId, ref:'User'},
    post: { type: Schema.Types.ObjectId, ref:'Post',default: null},
    fee : { type: Number, default: 0}
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

PurchasedSchema.statics.insertPurchase = async function (userId,postId,fee) {

    let data = new Array();
    data['buyer'] = userId;
    data['post'] = postId;
    data['fee'] = fee;
    const purchased = new this(data);

    const con = await purchased.save().then(t => t.populate('buyer', 'avatar _id username').populate({
        path: 'post',
        select: '_id media type',
        populate: {
            path: 'owner',
            select: 'email'
        }
    }).execPopulate());
    if(!con){
        return null;
    }
    else{
        return con;
    }
};

PurchasedSchema.statics.getPurchased = async function (purchaser,postId) {
    return this.find(
        {
            buyer: purchaser,
            postId: postId
        }
    )

        .lean()
        .exec();
};

PurchasedSchema.index({ hashTags: 1 });
PurchasedSchema.plugin(toJson);
PurchasedSchema.plugin(uniqueValidator);
PurchasedSchema.plugin(timestamps);
module.exports = mongoose.model('Purchased', PurchasedSchema);