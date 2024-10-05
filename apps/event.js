'use strict';
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.DBURL;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});
const db = process.env.DB
const event_table = "event"
const product_table = "product"
const deal_table = "deal"
const { response } = require("../init/res");
const { uuid } = require("uuidv4");
const { convertData } = require("../init/convertData")
const { addNotification } = require('../init/addNotification')
const winner = require('./winner')
const fields = {
    productId: { type: String },
    eventName: { type: String },
    productName: { type: String },
    description: { type: String, default: '' },
    category: { type: String },
    image: { type: String },
    status: { type: String, default: 'active' },
    price: { type: Number },
    phien: { type: Number },
    currentPoint: { type: Number, default: 0 },
    totalPoint: { type: Number },
    winnerNumber: { type: Number, default: 0 },
    winner: { type: String, default: null },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
};
// const axios = require("axios");
// const TableName = process.env.EVENT_TABLE;
// const dealTable = process.env.DEAL_TABLE;
// const productTable = process.env.PRODUCT_TABLE;
module.exports.create = async (event, context, callback) => {
    const event_table_ = client.db(db).collection(event_table);
    // let user = context.jwtDecoded;
    let user = context.prev;
    // console.log(user.role)
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        let reqBody = JSON.parse(event.body);
        let data = convertData(fields, reqBody);
        console.log(data)
        return event_table_.insertOne(
            data
        ).then((res) => {
            console.log(res)
            return response(res, "succces", 200);
        })
            .catch((err) => {
                return response("", "server error", 400)
            })

    }

};

module.exports.createEvent = async (item) => {
    const event_table_ = client.db(db).collection(event_table);
    const product_table_ = client.db(db).collection(product_table);
    console.log(item)
    product_table_.findOne({
        _id: new ObjectId(item.productId)
    }).then(res => {
        if (res.quantity > 0) {
            let data = {}
            data.eventName = (new Date(item.createdAt).getDate() === new Date().getDate()) ? ('Phiên ' + (item.phien + 1) + '-' + new Date().getDate() + "/" + (new Date().getMonth() + 1) + "/" + new Date().getUTCFullYear() + ': ' + item.productName) : ('Phiên 1 - ' + new Date().getDate() + "/" + (new Date().getMonth() + 1) + "/" + new Date().getUTCFullYear() + ': ' + item.productName);
            data.price = item.price
            data.description = item.description
            data.image = item.image
            data.productName = item.productName
            data.productId = item.productId
            data.totalPoint = item.totalPoint
            data.category = item.category
            data.phien = item.phien + 1;
            data = convertData(fields, data)
            // console.log(data)

            product_table_.updateOne({
                _id: new ObjectId(item.productId),
            }, {
                $set: { quantity: res.quantity - 1, }
            }
            )
            return event_table_.insertOne(data)

        }
    })
};

module.exports.delete = async (event, context, callback) => {

    // let user = context.jwtDecoded;
    let user = context.prev;
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        const id = event.pathParameters.id
        const event_table_ = client.db(db).collection(event_table);
        return event_table_.updateOne({ _id: new ObjectId(id) }, { $set: { status: "delete" } })
            .then((res) => {
                return response(res, "success", 200)
            })
    }

};

module.exports.get = async (event, context, callback) => {
    const id = event.pathParameters.id;
    const event_table_ = client.db(db).collection(event_table);
    return event_table_.findOne(
        {
            _id: new ObjectId(id)
        }
    ).then((res) => {
        console.log(res)
        if (!res) return response("", "event not exist or finished", 400)
        return response(res, "success", 200)
    })
        .catch((err) => {
            return response("", "server error", 500)
        })
};

module.exports.getAll = async (event, context, callback) => {
    const event_table_ = client.db(db).collection(event_table);

    return event_table_.find({ status: "active" })
        .toArray()
        .then((res) => {
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", err, 500)
        })
};

module.exports.spin = async (event, context, callback) => {
    const event_table_ = client.db(db).collection(event_table);
    const deal_table_ = client.db(db).collection(deal_table);

    event_table_.find({ status: "active" })
        .toArray()
        .then((res) => {
            // console.log(res)
            res.forEach(r => {
                if (r.currentPoint / r.totalPoint >= 0.5) {
                    // console.log(r)
                    this.createEvent(r)
                    const id = r._id;
                    console.log(id)
                    deal_table_.find(
                        {
                            eventId: id.toString()
                        }
                    ).toArray().then((result) => {
                        console.log(result)
                        var kq = Math.floor(Math.random() * r.currentPoint);
                        result.forEach(async (item) => {
                            if (kq > item.beginNumber && kq < item.endNumber) {
                                // await addNotification(item.userId, {
                                //     eventId: r.eventId,
                                //     content: 'Chúc mừng bạn là người chiến thắng sự kiện ' + r.eventName + ' với con số may mắn ' + kq,
                                //     image: r.image
                                // });
                                winner.push({
                                    eventId: r._id,
                                    userId: item.userId,
                                    username: item.username,
                                    eventName: r.eventName,
                                    image: r.image,
                                    eventPrice: r.price,
                                    point: item.point,
                                    result: kq
                                })
                                // // console.log(item.userId)
                                event_table_.updateOne({ _id: new ObjectId(id) }, {
                                    $set: { winner: item.username, status: "finish", winnerNumber: kq }

                                })
                            } else {
                                // console.log(1)
                                // await addNotification(item.userId, {
                                //     eventId: r.eventId,
                                //     content: 'Sự kiện ' + r.eventName + ' đã kết thúc với con số may mắn ' + kq + '.Chúc bạn may mắn lần sau',
                                //     image: r.image
                                // })
                            }
                        })
                    })
                    // .catch((err) => {
                    //     console.log(err)
                    // })
                    // console.log(new Date().getDate - new Date(r.createdAt).getDate())
                }
            });
        })
    // .catch((err) => {
    //     return response("", err, 500)
    // })
};

module.exports.update = async (event, context, callback) => {
    let user = context.prev;
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        const event_table_ = client.db(db).collection(event_table);
        const id = event.pathParameters.id;
        return event_table_.findOne({
            _id: new ObjectId(id)
        }).then(res => {
            if (!res) return response("", "event not exist")
            const item = JSON.parse(event.body);
            return event_table_.updateOne({ _id: new ObjectId(id) }, { $set: item })
                .then((res) => {
                    return response(res, "success", 200)
                })
        })
            .catch(err => {
                return response("", err, 500)
            })

    }

};