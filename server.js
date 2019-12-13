// Built-in Node.js modules
var fs = require('fs')
var path = require('path')
var bodyParser = require('body-parser');
// NPM modules
var express = require('express');
var sqlite3 = require('sqlite3');
var js2xmlparser = require("js2xmlparser");


var template_dir = path.join(__dirname, 'docs');
var public_dir = path.join(__dirname, 'public');
var db_filename = path.join(__dirname, 'db', 'stpaul_crime.sqlite3');

var app = express();
var port = 8000;

// open the database
var db = new sqlite3.Database(db_filename, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.log('Error opening ' + db_filename);
    }
    else {
        console.log('Now connected to ' + db_filename);
    }
});

app.use(bodyParser.urlencoded({encoded: true}));


function getCrimeTable(visibleNeighborhoods){
    return new Promise((resolve, reject) => {
        var c = "";
		var d = "";
		var sql = "";
		
		
		sql = "SELECT case_number, date_time, incident, police_grid, neighborhood_name, block FROM Incidents, Neighborhoods WHERE Incidents.neighborhood_number = Neighborhoods.neighborhood_number AND date_time>='2019-10-01' AND date_time <='2019-10-31' Order By date_time ASC";
		
		
        db.all(sql, (err,rows) => {
            if(err){
                throw err;
            }
            for(var crime in rows) {
				
				c += '<tr>';
				c += '<td>' + rows[crime]["case_number"] + '</td>';
				c += '<td>' + rows[crime]["date_time"] + '</td>\n' + '<td>' + rows[crime]["incident"] + '</td>\n';
				c += '<td>' + rows[crime]["police_grid"] + '</td>\n' + '<td>' + rows[crime]["neighborhood_name"] + '</td>\n' + '<td>' + rows[crime]["block"] + '</td></tr>';
				
			}
			
            resolve(JSON.stringify(rows));
        });
    });
}

function getCrimeTotals(visibleNeighborhoods){
	return new Promise((resolve, reject) => {
		var c = "";
		var sql;
		
		sql = "SELECT COUNT(case_number) AS num, neighborhood_name, Incidents.neighborhood_number FROM Incidents, Neighborhoods WHERE Incidents.neighborhood_number = Neighborhoods.neighborhood_number AND date_time >= '2019-10-01' AND date_time <= '2019-10-31' GROUP BY neighborhood_name ORDER BY Neighborhoods.neighborhood_number";
		
		db.all(sql, (err, rows) => {
			if(err) {
				throw err;
			}
			c += '[';
			for(var count in rows) {
				c += rows[count]["num"] + ", ";
			}
			c = c.substring(0, c.length - 2);
			c += ']';
			
			resolve(c);
		});
	});
}



function newIncident(req, res) {
	return new Promise((resolve, reject) => {
		var message = "";
		var foundDuplicate = false;
		var dateTime = req.body.date + "T" + req.body.time;

		db.all("SELECT case_number FROM Incidents", (err, rows) => {
			if (err) {
				throw err;
			}
			for (key in rows) {
				var a = parseInt(rows[key].case_number, 10);
				var b = parseInt(req.body.case_number, 10);
				if (a == b) {
					resolve(res.status(500).send('Error, case number already exists in the database'));
					foundDuplicate = true;
				}
			}
			if (!foundDuplicate) {
				db.all("INSERT INTO Incidents VALUES (?, ?, ?, ?, ?, ?, ?)", [req.body.case_number], [dateTime], [req.body.code], [req.body.incident], [req.body.police_grid], [req.body.neighborhood_number], [req.body.block], (err, new_rows) => {
					if (err) {
						throw err;
					}
					resolve(res.status(200).send('Success!'));
				});
			}
		});
		
		
	});
}

function getIncidents(r_start_date, r_end_date, r_code, r_grid, r_neighborhood, r_limit) {
	return new Promise((resolve, reject) => {
		var incidents = {};
		var sql = "SELECT case_number, date_time, code, incident, police_grid, neighborhood_number, block FROM Incidents WHERE 1=1";
		var number_times;
		
		if (r_start_date != undefined) {
			sql = sql + " AND date_time >= '" + r_start_date + "'";
		}
		if (r_end_date != undefined) {
			sql = sql + " AND date_time <= '" + r_end_date + "'";
		}
		if (r_code != undefined) {
			sql = sql + " AND code IN (" + r_code + ")";
		}
		if (r_grid != undefined) {
			sql = sql + " AND police_grid IN (" + r_grid + ")";
		}
		if (r_neighborhood != undefined) {
			sql = sql + " AND neighborhood_number IN (" + r_neighborhood + ")";
		}
		if (r_limit != undefined) {
			number_times = r_limit;
			
		}
		else if (r_limit == undefined) {
			number_times = 10000;
		}
		sql = sql + " ORDER BY date_time DESC";
		db.all(sql, (err, rows) => {
			if (err) {
				throw err;
			}

			var i = 0;
			for(var key in rows) {
				if(i < number_times) {
					var currentValue = {};
					
					currentValue["date"] = rows[key].date_time.slice(0, 10);
					currentValue["time"] = rows[key].date_time.slice(11, 19);
					currentValue["code"] = rows[key].code;
					currentValue["incident"] = rows[key].incident;
					currentValue["police_grid"] = rows[key].police_grid;
					currentValue["neighborhood_number"] = rows[key].neighborhood_number;
					currentValue["block"] = rows[key].block;
					
					incidents["I" + rows[key].case_number] = currentValue;
					i++;
				}
			}
			
			resolve(incidents);
		});
		
	});
}

function getNeighborhoods(selected_hoods) {
	return new Promise((resolve, reject) => {;
		var hoods = {};
		if (selected_hoods != undefined) {
			var sql = "SELECT neighborhood_number, neighborhood_name FROM Neighborhoods WHERE neighborhood_number IN (" + selected_hoods + ")";
		}
		else {
			var sql = "SELECT neighborhood_number, neighborhood_name FROM Neighborhoods"; 
		}
		db.all(sql, (err, rows) => {
			if (err) {
				throw err;
			}
			for (var key in rows) {
				hoods["N" + rows[key].neighborhood_number] = rows[key].neighborhood_name;
			}
			resolve(hoods);
		});
	});
}

function getCodes(selected_codes) {
	return new Promise((resolve, reject) => {	
		var codes = {};
		if (selected_codes != undefined) {
			
			var sql = "SELECT code, incident_type FROM Codes WHERE code IN (" + selected_codes + ")";
		}
		else {
			var sql = "SELECT code, incident_type FROM Codes";
		}
		db.all(sql, (err, rows) => {
			if (err) {
				throw err;
			}
			for (var key in rows) {
				codes["C" + rows[key].code] = rows[key].incident_type;
			}
			resolve(codes);
		});
	});
}

app.get('/', (req, res) => {
    ReadFile(path.join(template_dir, 'index.html')).then((template) => {
        let response = template;
		var hoods = [];
		Promise.all([getCrimeTable(), getCrimeTotals()]).then((data) => {
			
			response = response.replace(/!!!CRIME_DATA!!!/g, data[0].toString());
			response = response.replace(/!!!CRIME_COUNTS!!!/g, data[1]);
			WriteHtml(res, response);
		});
    }).catch((err) => {
        Write404Error(res);
    });
});

app.get('/about', (req, res) => {
	ReadFile(path.join(template_dir, 'about.html')).then((template) => {
        let response = template;
		
		WriteHtml(res, response);
		
    }).catch((err) => {
        Write404Error(res);
    });
});

app.get('/codes', (req, res) => {
	
	Promise.all([getCodes(req.query.code)]).then((data) => {
		if (req.query.format == 'xml') {
			
			res.type('application/xml').send(js2xmlparser.parse("toconvert",data));
		}
		else {
			res.type('json').send(data);
		}
		
    }).catch((err) => {
        console.log("error");
    });
	
});

app.get('/neighborhoods', (req, res) =>  {
Promise.all([getNeighborhoods(req.query.id)]).then((data) => {
if (req.query.format == 'xml') {
res.type('application/xml').send(js2xmlparser.parse("toconvert",data));
}
else {
res.type('json').send(data);
}
    }).catch((err) => {
        console.log("error");
    });

});


app.get('/incidents', (req, res) => {
	Promise.all([getIncidents(req.query.start_date, req.query.end_date, req.query.code, req.query.grid, req.query.id, req.query.limit)]).then((data) => {
		if (req.query.format == 'xml'){
			res.type('application/xml').send(js2xmlparser.parse("toconvert",data));
		}
		else {
			res.type('json').send(data);
		}
    }).catch((err) => {
        console.log("error");
    });
	
});

app.put('/new-incident', (req, res) => {
	Promise.all([newIncident(req, res)]).then((data) => {
		
    }).catch((err) => {
		console.log(err);
    });
	
});

function ReadFile(filename) {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, (err, data) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(data.toString());
            }
        });
    });
}

function WriteHtml(res, html) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(html);
    res.end();
}


var server = app.listen(port);