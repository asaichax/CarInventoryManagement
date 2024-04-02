// Team 1

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const https = require('https');
const fs = require('fs');
const data = require('./dataModel');
const { query } = require('express-validator');

const app = express();

const PORT = process.env.PORT || 3000;

mongoose.connect('mongodb://localhost:27017/carInventory', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: 'team1',
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: true,
        maxAge: 3600000,
        httpOnly: true
    }
}));

app.use(helmet());



app.get('/', async (req, res) => {
    try {
        await User.findOne({
            username: 'admin',
        })
            .then(async (document) => {
                if (document != null) {
                    userExist = true;
                } else {
                    const username = 'admin';
                    const email = 'admin@cars.com'
                    const password = 'admin';
                    const hashedPassword = await bcrypt.hash(password, 1);
                    await User.create({ username, password: hashedPassword, email });
                }
            });
    } catch (error) {
        console.log(error)
    }
    res.render('index', { PORT });
});

//User Validation and Registration

const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    email: String,
    role: { type: String, enum: ['admin', 'client'], default: 'client' }
});
const User = mongoose.model('User', UserSchema);

app.post('/login', query('username').notEmpty(), async (req, res) => {
    console.log("Login Started!");
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = user;
            if (user.username === 'admin') {
                res.redirect('/manage-cars')
            } else {
                res.redirect('/get-cars');
            }
        } else {
            res.status(401).send('Invalid credentials!');
        }
    } catch (error) {
        res.status(427).send(`<h1 style="color:red;">Login failed!</h1><br><a href="https://localhost:${PORT}/">Return to website</a>`);
    }
});

app.post('/register', query('username').notEmpty(), async (req, res) => {
    console.log("Registration Started!");
    const { username, password, email } = req.body;
    console.log(username, password, email);
    let userExist = false;
    try {
        await User.findOne({
            username: `${username}`,
        })
            .then((document) => {
                if (document != null) {
                    userExist = true;
                }
            });
        console.log(userExist);
        if (!userExist) {
            const hashedPassword = await bcrypt.hash(password, 1);
            await User.create({ username, password: hashedPassword, email });
            res.render('index', { PORT });
        } else {
            res.status(427).send(`<h1 style="color:red;">User Name already exist!</h1><br><a href="https://localhost:${PORT}/">Return to website</a>`);
        }

    } catch (error) {
        console.log(error)
        res.status(500).send(`<h1 style="color:red;">Registration failed!</h1><br><a href="https://localhost:${PORT}/">Return to website</a>`);
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            res.status(500).send('Logout failed!');
        } else {
            res.render('index', { PORT });
        }
    });
});

// Car Inventory Management

app.get('/get-cars', (req, res) => {
    const user = req.session.user;
    if (user) {
        data.find()
            .then((cars) => {
                res.render('inventory', { 'cars': cars, PORT });
            });
    } else {
        res.status(500).send(`<h1 style="color:red;">Session Expired!</h1><br><a href="https://localhost:${PORT}/">Return to website</a>`);
    }
});

app.get('/search-cars?:filter', (req, res) => {
    const filter = req.query.filter;
    const userInput = req.query.userInput;
    console.log(`filter ${filter}`);
    console.log(`searchInput ${req.query.userInput}`);
    console.log(req.params);
    const user = req.session.user;
    if (user) {
        data.find({
            [`${filter}`]: `${userInput}`,
        })
            .then((cars) => {
                console.log(cars);
                if (cars === null) {
                    cars = [];
                }
                if (user.username === 'admin') {
                    res.render('manage', { 'cars': cars, PORT });
                } else {
                    res.render('inventory', { 'cars': cars, PORT });
                }
            });
    } else {
        res.status(500).send(`<h1 style="color:red;">Session Expired!</h1><br><a href="https://localhost:${PORT}/">Return to website</a>`);
    }
});

app.get('/manage-cars', (req, res) => {
    const user = req.session.user;
    if (user && user.username === 'admin') {
        data.find()
            .then((cars) => {
                res.render('manage', { 'cars': cars, PORT });
            });
    } else {
        res.status(500).send(`<h1 style="color:red;">UnAuthorized! Admin only access, contact admin</h1><br><a href="https://localhost:${PORT}/">Return to website</a>`);
    }
});

app.get('/add', (req, res) => {
    const user = req.session.user;
    if (user && user.username === "admin") {
        res.render('add', { PORT });
    } else {
        res.status(500).send(`<h1 style="color:red;">Session Expired!</h1><br><a href="https://localhost:${PORT}/">Return to website</a>`);
    }
});

app.post('/add-car', (req, res) => {
    const user = req.session.user;
    if (user && user.username === 'admin') {
        const { c_brand, c_model, c_type, c_fuel, c_mileage, c_price } = req.body;

        const car = new data({
            brand: `${c_brand}`,
            model: `${c_model}`,
            type: `${c_type}`,
            fuel: `${c_fuel}`,
            mileage: `${c_mileage}`,
            price: `${c_price}`
        });

        car.save()
            .then(() => {
                console.log('car data added successfully!');
            })
            .catch((err) => {
                console.error('Error adding car data:', err);
                res.redirect(`https://localhost:${PORT}/get-cars`);
            });
        res.redirect(`https://localhost:${PORT}/manage-cars`);
    } else {
        res.status(500).send(`<h1 style="color:red;">UnAuthorized! Admin only access, contact admin</h1><br><a href="https://localhost:${PORT}/">Return to website</a>`);
    }
});

app.post('/edit-car/:id', (req, res) => {
    data.find()
        .then((cars) => {
            console.log(cars);
            res.render('manage', { 'cars': cars, PORT });
        });
});

app.post('/delete-car/:id', (req, res) => {
    const user = req.session.user;
    if (user && user.username === 'admin') {
        console.log(req.params.id);
        data.deleteOne({
            _id: `${req.params.id}`
        })
            .then(() => {
                console.log('car data deleted successfully!');
            })
            .catch((err) => {
                console.error('Error deleting car data:', err);
            });
        res.redirect('/manage-cars');
    } else {
        res.status(500).send(`<h1 style="color:red;">UnAuthorized! Admin only access, contact admin</h1><br><a href="https://localhost:${PORT}/">Return to website</a>`);
    }
});




// https config
const httpsOptions = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('certificate.pem')
};

https.createServer(httpsOptions, app).listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});