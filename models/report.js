const mongoose = require('mongoose');
const timestamps = require('mongoose-timestamp');
var uniqueValidator = require('mongoose-unique-validator');
const toJson = require('@meanie/mongoose-to-json');
const Schema = mongoose.Schema;

const ReportSchema = new Schema({

    type: { type: Number, default: 1 }, //  1: status , 2: image , 3: video
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: '', required: true },
    description: { type: String, default: '' },
    isFlagged: { type: Boolean, default: false },
    media: { type: String, default: '' },
    thumb: { type: String, default: '' },
    date: { type: Date, default: Date.now() },
});


ReportSchema.statics.createNewPost = function (userId, params) {
    let data = params;
    data['owner'] = userId;
    let _data = JSON.stringify(data);
    const post = new this(data);
    return post.save().then(t => t.populate('owner', 'avatar _id username email').execPopulate());
};

ReportSchema.statics.getAll = function (){
    return this.find()
        .populate('owner')
        .sort({ createdAt: -1 })
        .lean()
        .exec();
}

ReportSchema.statics.updateFlagg = function(id){
    return this.findOneAndUpdate({ _id: id }, {
        isFlagged: true
    })
        .lean()
        .exec();
}

ReportSchema.statics.ceateReply = function(id,description){
    return this.findOneAndUpdate({ _id: id }, {
        description: description
    })
        .lean()
        .exec();
}

ReportSchema.statics.deleteReports = function(ids) {
    if (ids == 'all'){
        return this.remove().exec();
    }
    else{
        const ids_array = ids.split(",");
        return this.find().where('_id').in(ids_array).remove().exec();
    }
}

ReportSchema.statics.getReportFrom = function(start, count, userId) {
    return this.find({
        owner: userId
    })
        .sort({ createdAt: -1 })
        .skip(start)
        .limit(count)
        .lean()
        .exec();
}

ReportSchema.index({ hashTags: 1 });
ReportSchema.plugin(toJson);
ReportSchema.plugin(uniqueValidator);
ReportSchema.plugin(timestamps);
module.exports = mongoose.model('Report', ReportSchema);