const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());
let db = null;

const initAndDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => console.log("Server Running"));
  } catch (err) {
    console.log(`error: ${err.message}`);
    process.exit(1);
  }
};

initAndDbServer();
const convertStateDbToResponse = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
};
const convertDistrictDbToResponse = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUser = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(selectUser);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
  
  if (isPasswordMatched === true) {
    const payload = {
      username: username,
    };
    const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
    response.send({ jwtToken });
  } else {
    response.status(400);
    response.send("Invalid password");
   }
  }
});

app.get("/states/", authenticateToken, async (request, response) => {
  const getStates = `SELECT * FROM state;`;
  const states = await db.all(getStates);
  response.send(states.map((each) => convertStateDbToResponse(each)));
});
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getState = `SELECT * FROM state WHERE state_id=${stateId};`;
  const state = await db.get(getState);
  response.send(convertStateDbToResponse(state));
});
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrict = `SELECT * FROM district WHERE district_id=${districtId};`;
    const district = await db.get(getDistrict);
    response.send(convertDistrictDbToResponse(district));
  }
);
app.post("/districts/", authenticateToken, async (request, response) => {
  const { stateId, districtName, cases, cured, active, deaths } = request.body;
  const postDistrict = `INSERT INTO district (stateId,districtName,cases,cured,active,deaths)
        VALUES (${stateId},'${districtName}',${cases},${cured},${active},${deaths});`;
  await db.run(postDistrict);
  response.send("District Successfully Added");
});
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `DELETE FROM district WHERE district_id=${districtId};`;
    await db.run(deleteDistrict);
    response.send("District Removed");
  }
);
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrict = `UPDATE district SET 
        district_name='${districtName}',
        state_id=${stateId},
        cases=${cases},
        cured=${cured},
        active=${active},
        deaths=${deaths}
        WHERE district_id=${districtId};`;
    await db.run(updateDistrict);
    response.send("District Details Updated");
  }
);
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStats = `SELECT SUM(cases),SUM(cured),SUM(active),SUM(deaths)
    FROM district WHERE state_id=${stateId};`;
    const stats = await db.get(getStateStats);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
module.exports = app;
