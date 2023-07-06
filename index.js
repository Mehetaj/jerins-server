require("dotenv").config()
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const jwt = require("jsonwebtoken")
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY)

// Middlewares
app.use(cors());
app.use(express.json())


const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "Unauthorized access" })
  }

  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}






const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4bdkenh.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    /---------------------/
    const servicesCollection = client.db("jerinsParlour").collection("services");
    const reviewsCollection = client.db("jerinsParlour").collection("reviews");
    const cartsCollection = client.db("jerinsParlour").collection("carts");
    const usersCollection = client.db("jerinsParlour").collection("users")
    const paymentsCollection = client.db("jerinsParlour").collection("payments")

    // verify admin

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }


    // verify jwt token

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token })
    })

    // services api

    app.get("/services", async (req, res) => {
      const result = await servicesCollection.find().toArray();
      res.send(result)
    })

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await servicesCollection.find(filter).toArray();
      res.send(result)
    })


    app.post("/services", async (req, res) => {
      const service = req.body;
      const result = await servicesCollection.insertOne(service);
      res.send(result)
    })

    app.delete("/services/:id",verifyJWT,verifyAdmin, async(req, res) => {
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = servicesCollection.deleteOne(query);
      res.send(result)
    })

    // reviews api
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result)
    })

    app.get("/ordered", async(req, res) => {
      const result = cartsCollection.find().toArray();
      res.send(result)
    })

    // carts api
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      // console.log(email);
      if (!email) {
        res.send([])
      }

      const decodedEmail = req.decoded.email;
      console.log(decodedEmail);
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'Forbidden Access' })
      }


      const query = { email: email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result)

    })

    app.post('/carts', async (req, res) => {
      const item = req.body;
      const result = await cartsCollection.insertOne(item);
      res.send(result)
    })


    // users api
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existing_user = await usersCollection.findOne(query)
      if (existing_user) {
        return res.send({ message: 'user_already_exist' })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })


    // admin api

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        return res.status(401).send({ admin: false })
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user.role === 'admin' };
      res.send(result)
    })

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    // payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.post("/payment", verifyJWT, async(req, res) => {
      const payment = req.body;
      const insertedResult = await paymentsCollection.insertOne(payment);
      const id = payment.itemId
      const query = {_id: new ObjectId(id)}
      const deletedResult = cartsCollection.deleteOne(query)

      res.send({insertedResult, deletedResult})
    })






    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);









app.get('/', (req, res) => {
  res.send("Jerin Apa Vala Achen")
})

app.listen(port, () => {
  console.log('Jerins apar server douraitase port in ', port);
})