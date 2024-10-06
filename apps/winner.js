'use strict';
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.DBURL;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});
const db = process.env.DB
const winner_table = "winner"
const user_table = "user"
const { response } = require("../init/res");
const { convertData } = require("../init/convertData")
const { create_balance_fluctuation } = require("./balance_fluctuation")
const fields = {
    userId: { type: String },
    username: { type: String },
    eventId: { type: String },
    eventName: { type: String },
    fullname: { type: String, default: null },
    phonenumber: { type: String, default: null },
    option: { type: String, default: 'product' },
    address: { type: String, default: null },
    status: { type: String, default: 'active' },
    image: { type: String },
    result: { type: Number },
    eventPrice: { type: Number },
    point: { type: Number },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
};
module.exports.push = async (item) => {
    const winner_table_ = client.db(db).collection(winner_table);
    let data = convertData(fields, item);
    // console.log(data)
    return winner_table_.insertOne(
        data
    )

};
module.exports.getAll = async (event, context, callback) => {
    const winner_table_ = client.db(db).collection(winner_table);

    return winner_table_.find({})
        .toArray()
        .then((res) => {
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", err, 500)
        })
};

module.exports.reward = async (event, context, callback) => {
    let user = context.prev;
    const item = JSON.parse(event.body);
    console.log(item)
    const winner_table_ = client.db(db).collection(winner_table);
    const user_table_ = client.db(db).collection(user_table);
    return winner_table_.findOne({
        eventId: item.eventId
    })
        .then(async res => {
            console.log(res)
            if (!res) return response("", "Sai thông tin", 500)
            if (res.userId != user._id) return response("", "Yêu cầu không hợp lệ", 500);
            if (res.status != 'active') return response("", "Giải thưởng đã được trao", 500)
            if (item.option == 'product') {
                item.status = 'waitting'
                return winner_table_.updateOne({ winnerId: res.winnerId }, { $set: item })
                    .then((res) => {
                        return response(res, "success", 200)
                    })
            } else if (item.option == 'money') {
                // console.log(1)


                await create_balance_fluctuation(item.money, `Tra thuong su kien`, user._id)
                winner_table_.updateOne({
                    winnerId: res.winnerId
                }, {
                    $set: {
                        option: 'money',
                        status: 'finish'
                    },
                }

                )
            }

            return response("", "success", 200)
        })
        // .catch(err => {
        //     return response("", err, 500)
        // })



};