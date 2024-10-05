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
const { response } = require("../init/res");
<<<<<<< HEAD
const db = require('../init/db');
=======
const { uuid } = require("uuidv4");
>>>>>>> faaf951f1fa6b2986dd0d67386816a903ad19e16
const { convertData } = require("../init/convertData")
const TableName = process.env.WINNER_TABLE;
const userTable = process.env.USER_TABLE;
const fields = {
    // winnerId: { type: String, default: uuid() },
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
    console.log(user)
    return db.scan({
        TableName: TableName,
        FilterExpression: '#eventId = :eventId',
        ExpressionAttributeNames: {
            '#eventId': 'eventId',
        },
        ExpressionAttributeValues: {
            ':eventId': item.eventId,
        },
    }).promise()
        .then(res => {
            if (res.Count == 0) return response("", "Sai thông tin", 500)
            if (res.Items[0].userId != user.userId) return response("", "Yêu cầu không hợp lệ", 500);
            if (res.Items[0].status != 'active') return response("", "Giải thưởng đã được trao", 500)
            if (item.option == 'product') {
                let updateExpression = 'set';
                let ExpressionAttributeNames = {};
                let ExpressionAttributeValues = {};
                item.status = 'waitting'
                for (const property in item) {
                    updateExpression += ` #${property} = :${property} ,`;
                    ExpressionAttributeNames['#' + property] = property;
                    ExpressionAttributeValues[':' + property] = item[property];
                }
                updateExpression = updateExpression.slice(0, -1);
                const params = {
                    TableName: TableName,
                    Key: {
                        winnerId: res.Items[0].winnerId,
                    },
                    UpdateExpression: updateExpression,
                    ExpressionAttributeNames: ExpressionAttributeNames,
                    ExpressionAttributeValues: ExpressionAttributeValues
                };
                return db.update(params).promise()
                    .then((res) => {
                        return response(res, "success", 200)
                    })
            } else if (item.option == 'money') {
                // console.log(1)


                db.get({
                    TableName: userTable,
                    Key: {
                        userId: user.userId,
                    },
                }).promise().then(res => {
                    // console.log(res)
                    db.update({
                        TableName: userTable,
                        Key: {
                            userId: user.userId,
                        },
                        UpdateExpression: 'set #amout = :amout',
                        ExpressionAttributeNames: {
                            "#amout": "amout"
                        },
                        ExpressionAttributeValues: {
                            ":amout": res.Item.amout + item.money,
                        },
                    }).promise()
                }).catch(err => {
                    console.log(err)
                })
                db.update({
                    TableName: TableName,
                    Key: {
                        winnerId: res.Items[0].winnerId,
                    },
                    UpdateExpression: 'set #option = :option , #status = :status',
                    ExpressionAttributeNames: {
                        "#option": "option",
                        "#status": "status"
                    },
                    ExpressionAttributeValues: {
                        ":option": 'money',
                        ":status": 'finish'
                    },
                }).promise()
            }

            return response("", "success", 200)
        })
        .catch(err => {
            return response("", err, 500)
        })



};