const express = require('express');
const session = require('express-session');
const cors = require('cors');
const bodyParser = require('body-parser');

const axios = require('axios').default;

const crypto = require("crypto");
const SECRET = crypto.randomBytes(128).toString('hex');
//const redis = require('redis');

const app = express();
const port = 3000;

const corsOptions = {
    origin: 'http://localhost', 
    credentials: true,
    optionsSuccessStatus: 200
};

const sessionOptions = {
    secret: `${SECRET}`,
    resave: false,
    saveUninitialized: true,
};


// Data
let user_token_ttl = {
    // user_session: ttl
}
let user_fetched_question = {
    // user_session: { question }
};

// Clear data daily
const daily_clear_interval = setInterval(() => {
    console.log("SYSTEM: Start clear the data daily.");
    Object.keys(object).forEach(key => delete user_token_ttl[key]);
    Object.keys(object).forEach(key => delete user_fetched_question[key]);
}, 86400000);


// Function - Get OpenTDB token
async function getOpenTDBToken(res) {
    try {
        const response = axios.get('https://opentdb.com/api_token.php?command=request');
        return response;
    }catch (err){
        return res.send({
            state: 'error',
            msg: `${err}`
        });
    }
}

// Middleware - Third party
app.use(cors(corsOptions));
app.use(session(sessionOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Middleware - Check token exist
app.use('/api/*_question', (req, res, next) => {
    // If user don't have a token
    if(!req.session['opentdb_token']){
        return res.send({
            state: 'error',
            msg: `You don't have a token!`
        });
    }

    // If user token expired
    const date_now_sec = Math.floor(Date.now() / 1000);
    const token = req.session['opentdb_token'];
    if(date_now_sec >= user_token_ttl[token]){
        delete user_fetched_question[token];
        delete user_token_ttl[token];
        return res.send({
            state: 'error',
            msg: `Token expired!`
        });
    }

    next();
});

// Initial
app.get('/api/get_token', (req, res) => {
    const date_now_sec = Math.floor(Date.now() / 1000);
    const token = req.session['opentdb_token'];
    if(req.session['opentdb_token']){
        if(date_now_sec < user_token_ttl[token]){
            return res.send({
                state: 'warning',
                msg: `You already have a token!`,
                token: token
            });
        }else{
            req.session['opentdb_token'] = null;
            delete user_fetched_question[token];
            delete user_token_ttl[token];
        }
    }

    getOpenTDBToken(res).then((token_res)=>{
        const data = token_res.data;
        switch (data['response_code']) {
            case 0:
                req.session['opentdb_token'] = data['token'];
                user_token_ttl[data['token']] = date_now_sec + 21600;
                console.log(`Session created: ${req.session['opentdb_token']}`);
                return res.send({
                    state: "success",
                    token: data['token']
                });
            default:
                return res.send({
                    state: "error",
                    msg: `${data['response_code']}`
                });
        }
    });
});

// Get question
app.get('/api/get_question', (req, res) => {

    const token = req.session['opentdb_token'];

    axios.get('https://opentdb.com/api.php', {
        params: {
            amount: 1,
            token: token
        }
    }).then((question_res) => {
        const data = question_res.data;
        let current_question = data['results'][0];
        let current_answer = ["True", "False"];
        if(current_question['type'] === "multiple") {
            current_answer = current_question['incorrect_answers'].concat(current_question['correct_answer']);
            current_answer.sort(() => (Math.random() > .5) ? 1 : -1);
        }
        user_fetched_question[token] = current_question;
        return res.send({
            type: current_question['type'],
            question: current_question['question'],
            answer: current_answer
        });
    });
});

app.post('/api/answer_question', (req, res) => {
    //console.log(req.body);
    const token = req.session['opentdb_token'];
    const question = user_fetched_question[token];

    if(!user_fetched_question[token]) {
        return res.send({
            state: 'error',
            msg: `No question stored in this session!`
        });
    }

    const data = req.body;
    if(!Object.keys(data).includes("answer")){
        return res.send({
            state: 'error',
            msg: `Invaild data recived!`
        });
    }

    let result = "invaild"
    if(data['answer'] === question['correct_answer']){
        result = "correct";
    }else if(question['incorrect_answers'].includes(data['answer'])) {
        result = "wrong";

    }
    return res.send({
        result: result,
        correct_answer: question['correct_answer'],
        incorrect_answers: question['incorrect_answers']
    });
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});