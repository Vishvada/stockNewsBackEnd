import express from "express";
import bodyParser from "body-parser";
import passport from "passport";
import cors from 'cors'
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import { url } from "./utils/constants.js";
import { addUser, checkPassword, getUser, getUserStocks, getAllStocks, addUserStocks } from "./queries.js";
import news from "./utils/scraper.js";

const app = express();
const port = 3000;
app.use(cors({
  origin: ["http://localhost:5173", "https://your-frontend-domain.com"], // Add your frontend domain
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: "stockNews",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false}
}));
app.use(passport.initialize());
app.use(passport.session());

const createResponse = (status, error, message) => ({ status, error, message });


app.get('/',(req,res)=>{
  res.send("HELLO")
})
app.get('/all-stocks', async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      let result = await getAllStocks();
      res.status(200).json(createResponse(url.OK, false, result.message));
    } catch (error) {
      console.error('Error fetching all stocks:', error);
      res.status(500).json(createResponse(url.INTERNAL_SERVER_ERROR, true, 'An error occurred while fetching stocks'));
    }
  } else {
    res.status(200).json(createResponse(url.FORBIDDEN, true, 'Sign In required'));
  }
});

app.post('/add-stocks', async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const { stockIds } = req.body;
      let result = await addUserStocks(req.user.email, stockIds);
      if (result.error) {
        res.status(400).json(createResponse(url.BAD_REQUEST, true, result.message));
      } else {
        res.status(200).json(createResponse(url.OK, false, result.message));
      }
    } catch (error) {
      console.error('Error adding stocks:', error);
      res.status(500).json(createResponse(url.INTERNAL_SERVER_ERROR, true, 'An error occurred while adding stocks'));
    }
  } else {
    res.status(200).json(createResponse(url.FORBIDDEN, true, 'Sign In required'));
  }
});


app.get('/stocks', async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      let result = await getUserStocks(req.user.email);
      let response = [];

      for (const stockName of result.message) {
        console.log(stockName);
        let stockNews = await news(stockName);
        response.push({ stock: stockName, news: stockNews });
      }

      res.status(200).json(createResponse(url.OK, false, response));
    } catch (error) {
      console.error('Error fetching stocks:', error);
      res.status(500).json(createResponse(url.INTERNAL_SERVER_ERROR, true, 'An error occurred while fetching stocks'));
    }
  } else {
    res.status(200).json(createResponse(url.FORBIDDEN, true, 'Sign In required'));
  }
});

app.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json(createResponse(url.FORBIDDEN, true, err.message));
    }
    if (!user) {
      return res.status(200).json(createResponse(url.UNAUTHORISED, true, 'Username or password incorrect!' || info.message ));
    }
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json(createResponse(url.FORBIDDEN, true, err.message));
      }
      return res.status(200).json(createResponse(url.OK, false, 'Logged in successfully'));
    });
  })(req, res, next);
});

app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    const result = await addUser(name, email, password);
    if (result.error) {
      return res.status(200).json(createResponse(url.FORBIDDEN, true, result.message));
    }
    
    req.login({ email, password }, (err) => {
      if (err) {
        return res.status(500).json(createResponse(url.FORBIDDEN, true, err.message));
      }
      res.status(201).json(createResponse(url.CREATED, false, 'User created and logged in successfully'));
    });
  } catch (err) {
    res.status(500).json(createResponse(url.FORBIDDEN, true, err.message));
  }
});

passport.use(new LocalStrategy(
  { usernameField: 'email' },
  async (email, password, done) => {
    try {
      const result = await checkPassword(email, password);
      if (result.error) {
        return done(null, false, { message: result.message });
      }
      return done(null, { email });
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, cb) => {
  cb(null, user.email);
});

passport.deserializeUser(async (email, cb) => {
  try {
    const result = await getUser(email);
    if (result !== 'error') {
      cb(null, result);
    } else {
      cb(new Error('User not found'));
    }
  } catch (err) {
    cb(err);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});