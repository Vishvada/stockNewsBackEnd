import pg from "pg"; 
import bcrypt from "bcryptjs";
import dotenv from 'dotenv'
import validator from 'email-validator'

const saltRounds = 10;

dotenv.config()

const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
})

db.connect().then(() => {
  console.log('DB connected');
}).catch((err) => {
  console.error('DB connection error:', err)
})

export async function addUser(name, email, password) {
  const response = { error: false, message: '' };
  
  if (!name || !email || !password || name.trim() === '' || email.trim() === '' || password.trim() === '') {
    response.error = true;
    response.message = "All fields are required.";
    return response;
  }

  if(!validator.validate(email)){
    response.error=true;
    response.message='Invalid email address,check again';
    return response;
  }

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (checkResult.rows.length > 0) {
      response.error = true;
      response.message = "Email already exists. Try logging in.";
    } else {
      const hash = await bcrypt.hash(password, saltRounds);
      const insertResult = await db.query(
        "INSERT INTO users(name, email, password) VALUES ($1, $2, $3)",
        [name.trim(), email.trim(), hash]
      );

      if (insertResult.rowCount > 0) {
        response.message = "User account created successfully.";
      } else {
        response.error = true;
        response.message = "Failed to create user account.";
      }
    }
  } catch (error) {
    response.error = true;
    response.message = error.message || "An unexpected error occurred";
    console.error("Error in addUser function:", error);
  }

  return response;
}

export async function checkPassword(email, loginPassword) {
  const response = { error: false, message: '' };

  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      const isMatch = await bcrypt.compare(loginPassword, user.password);
      
      if (isMatch) {
        response.message = "Logged in successfully.";
      } else {
        response.error = true;
        response.message = "Email and password do not match";
      }
    } else {
      response.error = true;
      response.message = "User doesn't exist";
    }
  } catch (err) {
    console.error("Error in checkPassword:", err);
    response.error = true;
    response.message = err.message || "An unexpected error occurred";
  }

  return response;
}

export async function getUser(email) {
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length > 0) {
      const user = result.rows[0];
      // Don't send the password hash to the client
      delete user.password;
      return user;
    } else {
      return null;
    }
  } catch (err) {
    console.error("Error in getUser:", err);
    throw err;
  }
}

export async function addStock(stockName) {
	try {
    let result=await db.query(`SELECT * from stocks where stock = $1`,[stockName]);
    if(result.rowCount>0){
      return;
    }
		await db.query(
			"INSERT INTO stocks (stock) VALUES ($1)",
			[stockName],
			(err, result) => {
				if (result) {
					console.log(`Succesfully added stock ${stockName}`);
				} else {
					console.error(err.message);
				}
			}
		);
	} catch (error) {
		console.error(error.message);
	}
}

export async function getUserStocks(email) {
	try {
	  const userResult = await db.query(
		"SELECT preferred_stocks FROM users WHERE email = $1",
		[email]
	  );
  
	  if (!userResult.rows.length) {
		return { error: true, message: "User not found" };
	  }
  
	  const stockIds = userResult.rows[0].preferred_stocks;
  
	  if (stockIds===null||!stockIds.length) {
		  return { error: false, message: [] };
	  }
  
	  const stocksResult = await db.query(
		"SELECT stock FROM stocks WHERE id = ANY($1)",
		[stockIds]
	  );
  
	  const stocks = stocksResult.rows.map(row => row.stock);
  
	  return { error: false, message: stocks };
	} catch (error) {
	  console.error("Error in getUserStocks:", error);
	  return { error: true, message: error.message };
	}
  }
  // ... (previous imports and setup remain the same)

export async function getAllStocks() {
  try {
    const result = await db.query("SELECT id, stock FROM stocks");
    return { error: false, message: result.rows };
  } catch (err) {
    console.error("Error in getAllStocks:", err);
    return { error: true, message: err.message };
  }
}

export async function addUserStocks(email, stockIds) {
  try {
    const userResult = await db.query(
      "SELECT id, preferred_stocks FROM users WHERE email = $1",
      [email]
    );

    if (!userResult.rows.length) {
      return { error: true, message: "User not found" };
    }

    const userId = userResult.rows[0].id;
    let preferredStocks = userResult.rows[0].preferred_stocks || [];

    // Add new stock IDs to the user's preferred stocks
    preferredStocks = [...new Set([...preferredStocks, ...stockIds])];

    await db.query(
      "UPDATE users SET preferred_stocks = $1 WHERE id = $2",
      [preferredStocks, userId]
    );

    return { error: false, message: "Stocks added successfully" };
  } catch (error) {
    console.error("Error in addUserStocks:", error);
    return { error: true, message: error.message };
  }
}