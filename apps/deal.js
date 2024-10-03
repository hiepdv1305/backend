'use strict';
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.DBURL;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});
const db = process.env.DB
const deal_table = "deal"
const event_table = "event"
const user_table = "user"
const { response } = require("../init/res");
const { create_balance_fluctuation } = require("./balance_fluctuation")
const { uuid } = require("uuidv4");
const { convertData } = require("../init/convertData")
const { addNotification } = require('../init/addNotification')

const fields = {
    eventId: { type: String },
    userId: { type: String },
    username: { type: String },
    eventName: { type: String },
    image: { type: String },
    eventPrice: { type: Number },
    price: { type: Number },
    beginNumber: { type: Number },
    endNumber: { type: Number },
    point: { type: Number },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
};
module.exports.create = async (event, context, callback) => {
    let user = context.prev;
    // console.log(user)
    const event_table_ = client.db(db).collection(event_table);
    const deal_table_ = client.db(db).collection(deal_table);
    let data = JSON.parse(event.body);

    let res = await create_balance_fluctuation(-data.price, `Thanh toan giao dich mua ${data.point} diem cua su kien ${data.eventName}`, user._id)
    if (res == 2) return response("", "Tai khoan khong du so du de thanh toan", 402)
    if (res == 0) return response("", "Giao dich xay ra loi", 403)
    return event_table_.findOne({
        _id: new ObjectId(data.eventId)
    }).then(async res => {
        // console.log(res)
        if (res.currentPoint + data.point > res.totalPoint) return response("", "Số điểm vượt quá số lượng còn lại", 500)
        await event_table_.updateOne(
            { _id: new ObjectId(data.eventId) },
            { $set: { currentPoint: res.currentPoint + data.point } }
        )
        data.beginNumber = res.currentPoint + 1
        data.endNumber = res.currentPoint + data.point
        data.userId = user._id
        data.username = user.username
        data = convertData(fields, data)
        console.log(data)
        return deal_table_.insertOne(data).then(res => {
            // addNotification(user.userId, {
            //     eventId: data.eventId,
            //     content: 'Bạn đã mua thành công ' + data.point + ' điểm trong sự kiện ' + data.eventName,
            //     image: data.image
            // })
            return response("", "success", 200)
        })
    })
};
module.exports.createDeal = async (event, context, callback) => {
    let user = context.prev;
    let data = JSON.parse(event.body);
    data.userId = user.userId
    data.username = user.username
    data = convertData(fields, data)
    console.log(data)
    await db.transactGet({
        TransactItems: [
            {
                Get: {
                    TableName: eventTable,
                    Key: {
                        HashKey: data.eventId,
                    },
                },
            },
            {
                Get: {
                    TableName: userTable,
                    Key: {
                        HashKey: user.userId,
                    },
                },
            },
        ],
    })
        .promise().then(res => {
            console.log(res)
        })
        .catch(err => {
            console.log(err)
        })
    // db.transactWrite({
    //     TransactItems: [
    //         {
    //             update: {
    //                 TableName: eventTable,
    //                 Key: {
    //                     eventId: data.eventId,
    //                 },
    //                 UpdateExpression: 'set #currentPoint = :currentPoint',
    //                 ExpressionAttributeNames: {
    //                     "#currentPoint": "currentPoint"
    //                 },
    //                 ExpressionAttributeValues: {
    //                     ":currentPoint": res.Items[0].currentPoint + data.point,
    //                 },
    //             }
    //         }
    //     ]
    // })
};
module.exports.eventGet = async (event, context, callback) => {
    const id = event.pathParameters.id;
    const deal_table_ = client.db(db).collection(deal_table);
    return deal_table_.find(
        {
            eventId: id
        }
    ).toArray()
        .then((res) => {
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", "server error", 500)
        })
};

module.exports.userGet = async (event, context, callback) => {
    let user = context.prev;
    const deal_table_ = client.db(db).collection(deal_table);
    return deal_table_.find(
        {
            userId: user._id
        }
    ).toArray()
        .then((res) => {
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", "server error", 500)
        })
};