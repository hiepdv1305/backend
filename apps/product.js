'use strict';
const AWS = require("aws-sdk");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.DBURL;
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});
const db = process.env.DB
const product_table = "product"
const s3 = new AWS.S3();
const Bucket = process.env.BUCKET;
const { response } = require("../init/res");
const { convertData } = require("../init/convertData")
const fields = {
    productName: { type: String },
    description: { type: String, default: '' },
    category: { type: String },
    image: { type: String },
    status: { type: String, default: 'active' },
    price: { type: Number },
    quantity: { type: Number },
    createdAt: { type: Date, default: new Date().toISOString() },
    updatedAt: { type: Date, default: new Date().toISOString() }
};
// const axios = require("axios");
const TableName = process.env.PRODUCT_TABLE;

module.exports.create = async (event, context, callback) => {
    const product_table_ = client.db(db).collection(product_table);
    // let user = context.jwtDecoded;
    let user = context.prev;
    // console.log(user.role)
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        let reqBody = JSON.parse(event.body);
        let data = convertData(fields, reqBody);
        // console.log(data)
        return product_table_.insertOne(data).then((res) => {
            console.log(res)
            return response(res, "succces", 200);
        })
            .catch((err) => {
                return response("", "server error", 400)
            })

    }

};

module.exports.get = async (event, context, callback) => {
    const product_table_ = client.db(db).collection(product_table);
    const id = event.pathParameters.id;
    return product_table_.findOne(
        {
            _id: new ObjectId(id)
        }
    ).then((res) => {
        if (!res) return response("", "product not exist", 400)
        return response(res, "success", 200)
    })
        .catch((err) => {
            return response("", err, 500)
        })
};

module.exports.delete = async (event, context, callback) => {
    const product_table_ = client.db(db).collection(product_table);
    // let user = context.jwtDecoded;
    let user = context.prev;
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        const id = event.pathParameters.id

        return product_table_.updateOne({ _id: new ObjectId(id) }, { $set: { status: "delete" } })
            .then((res) => {
                return response(res, "success", 200)
            })
    }

};

module.exports.getAll = async (event, context, callback) => {
    const product_table_ = client.db(db).collection(product_table);

    return product_table_.find({ status: "active" }).toArray()
        .then((res) => {
            return response(res, "success", 200)
        })
        .catch((err) => {
            return response("", err, 500)
        })
};

module.exports.update = async (event, context, callback) => {
    let user = context.prev;
    if (user.role != "admin") {
        return response("", "no permision", 500)
    } else {
        const product_table_ = client.db(db).collection(product_table);
        const id = event.pathParameters.id;
        console.log(id)
        return product_table_.findOne({
            _id: new ObjectId(id)
        }).then(res => {
            console.log(res)
            if (!res) return response("", "product not exist")
            const item = JSON.parse(event.body);

            return product_table_.updateOne({ _id: new ObjectId(id) }, { $set: item })
                .then((res) => {
                    return response(res, "success", 200)
                })
        })
            .catch(err => {
                return response("", err, 500)
            })

    }

};
module.exports.uploadFile = async (event, context, callback) => {
    // let file_data = JSON.parse(event.body);
    console.log(event.body)
    let file_data = JSON.parse(event.body);
    const params = {
        Bucket: Bucket,
        Key: "Picture/" + file_data.filename,
        ContentType: file_data.filetype, // Loại tệp tin
    };
    const presignedUrl = s3.getSignedUrl("putObject", params);
    return response(presignedUrl, "Presigned URL", 200);
};