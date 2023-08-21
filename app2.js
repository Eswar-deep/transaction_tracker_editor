const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const Payment = require("./mongodbschema");

const axios = require("axios");
const port = 3000;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const url =
  "mongodb+srv://pujala:Mongodb_pujala@cluster0.o8d1fhf.mongodb.net/csvdatabase";
mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;

db.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

db.once("open", () => {
  console.log("Connected to MongoDB_db");
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });
//read and upload file

app.post("/upload", upload.single("csvFile"), async (req, res) => {
  if (!req.file) {
    return res.send("No CSV file uploaded.");
  }

  const uploadedFilePath = req.file.path;
  const postparsedata = [];

  /////read file
  fs.createReadStream(uploadedFilePath)
    .pipe(csv())
    .on("data", async (row) => {
      const dateParts = row.Date.split("-");
      const dateObject = dateParts[2] + "-" + dateParts[1] + "-" + dateParts[0];

      try {
        const response = await axios.get(
          "https://api.exchangerate.host/" + dateObject
        );
        const USD = response.data.rates.USD;
        const INR = response.data.rates.INR;
        const Amount = row.Amount;
        const exchange_rate = INR / USD;

        const parsedRow = {
          Date: dateObject,
          Description: row.Description,
          Amount: Amount,
          Currency: row.Currency,
          INR_AMOUNT: Amount * exchange_rate,
        };
        postparsedata.push(parsedRow);
        // console.log(postparsedata);
      } catch (error) {
        console.error("Error fetching conversion data:", error);
      }
    })

    .on("end", async () => {
      setTimeout(() => {
        try {
          Payment.insertMany(postparsedata);
          console.log("Data inserted into MongoDB");
          res.sendFile(__dirname + "/frontend/operations.html");
        } catch (error) {
          console.error("Error:", error);
          res.send("An error occurred while processing and inserting data.");
        }
      }, 7000);
    });
});

////get data

async function getDataByRange(
  start,
  end,
  MINAmount,
  MAXAmount,
  descriptionKeyword
) {
  try {
    console.log("Searching for data between", start, "and", end);

    const query = {
      $and: [
        {
          Date: {
            $gte: start,
            $lte: end,
          },
        },
        {
          Amount: {
            $gte: MINAmount,
            $lte: MAXAmount,
          },
        },
      ],
    };

    if (descriptionKeyword) {
      query.$and.push({
        Description: {
          $regex: descriptionKeyword,
          $options: "i",
        },
      });
    }
    console.log({ descriptionKeyword });
    console.log(query);
    const dataofrange = await Payment.find(query);

    //console.log("Found data:", dataofrange);

    return dataofrange;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw error;
  }
}

app.post("/get", (req, res) => {
  let start = req.body.fromDate || "1000-01-01";

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  let end = req.body.toDate || `${yyyy}-${mm}-${dd}`;

  let MINAmount = req.body.MINAmount || 0;
  let MAXAmount = req.body.MAXAmount || Number.MAX_SAFE_INTEGER;

  let descriptionKeyword = req.body.descriptionKeyword || "";

  console.log(start);
  console.log(end);
  console.log(MINAmount);
  console.log(MAXAmount);
  console.log(descriptionKeyword);

  getDataByRange(start, end, MINAmount, MAXAmount, descriptionKeyword)
    .then((result) => {
      console.log(result);
      res.send("You can View the Results on the console Now :)");
    })
    .catch((error) => {
      console.error(error);
      res.send("An error occurred while fetching data.");
    });
});

async function edit(
  originalDate,
  originalDescription,
  originalAmount,
  updatedDate,
  updatedDescription,
  updatedAmount
) {
  try {
    const response_new = await axios.get(
      "https://api.exchangerate.host/" + updatedDate
    );
    const USD_new = response_new.data.rates.USD;
    const INR_new = response_new.data.rates.INR;
    const exchange_rate_new = INR_new / USD_new;

    const response_old = await axios.get(
      "https://api.exchangerate.host/" + originalDate
    );
    const USD_old = response_old.data.rates.USD;
    const INR_old = response_old.data.rates.INR;
    const exchange_rate_old = INR_old / USD_old;
    if (originalDate instanceof Date) {
      true;
    }
    console.log({ originalAmount });
    //INR_AMOUNT= obj.updatedAmount*exchange_rate;
    const updatedData = await Payment.findOneAndUpdate(
      {
        Date: originalDate,
        Description: originalDescription,
        Amount: originalAmount,
        Currency: "USD",
        // INR_AMOUNT:originalAmount*exchange_rate_old
      },
      {
        Date: updatedDate,
        Description: updatedDescription,
        Amount: updatedAmount,
        Currency: "USD",
        INR_AMOUNT: updatedAmount * exchange_rate_new,
      },
      { new: true }
    );

    if (!updatedData) {
      console.log("Data not found for editing");
      return null;
    }

    console.log("Updated data:");
    console.log(updatedData);
    return updatedData;
  } catch (error) {
    console.error("Error editing data:", error);
    throw error;
  }
}

app.post("/edit", async (req, res) => {
  try {
    await edit(
      req.body.originalDate,
      req.body.originalDescription,
      req.body.originalAmount,

      req.body.updatedDate,
      req.body.updatedDescription,
      req.body.updatedAmount
    );
    res.send("Document Edited Successfully");
  } catch (error) {
    res.send("An error occurred while editing the document.");
  }
});

//insert function and api

async function addtocollection(obj, dateObject) {
  try {
    const response = await axios.get(
      "https://api.exchangerate.host/" + dateObject
    );
    const USD = response.data.rates.USD;
    const INR = response.data.rates.INR;
    const exchange_rate = INR / USD;

    obj.INR_AMOUNT = obj.Amount * exchange_rate;

    const results = await Payment.insertMany(obj); // Use the Payment model
    return results;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

app.post("/insert", (req, res) => {
  console.log(req.body);
  const obj = {
    Date: req.body.Create_date,
    Description: req.body.Create_description,
    Amount: req.body.Create_amount,
    Currency: "USD",
  };
  addtocollection(obj, req.body.Create_date)
    .then((answer) => {
      console.log(answer);
      res.send("Data inserted successfully");
    })
    .catch((error) => {
      res.send("An error occurred while inserting data.");
    });
});

////////delete
async function deleteData(delobj) {
  try {
    console.log(delobj);
    const results = await Payment.deleteMany(delobj);
    return results.deletedCount;
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

app.post("/delete", (req, res) => {
  try {
    // const dateParts = req.body.delete_date.split('-');
    // const delobj = new Date(
    //     parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])
    // );

    const delobj = { Date: req.body.delete_date };
    console.log(typeof req.body.delete_date);
    deleteData(delobj)
      .then((deletedCount) => {
        console.log(deletedCount + " Documents were deleted");
        res.send(`Deleted Successfully`);
      })
      .catch((error) => {
        console.error("Error:", error);
        res.send("An error occurred while deleting data.");
      });
  } catch (error) {
    console.error("Error:", error);
    res.send("An error occurred while deleting data.");
  }
});

// Serve frontend files
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/frontend/index.html");
});

app.use(express.static("frontend"));

app.listen(port, () => {
  console.log("Server is running on port" + port);
});
