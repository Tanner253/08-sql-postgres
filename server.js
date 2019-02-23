'use strict';

// Application Dependencies
const express = require('express');
const superagent = require('superagent');
const pg = require('pg');
const cors = require('cors');

// Load environment variables from .env file
require('dotenv').config();

// Application Setup
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const client = new pg.Client(process.env.DATABASE_URL);
client.connect()
client.on('error', err => console.error(err));

// API Routes
app.get('/location', (request, response) => {
  getLocation(request.query.data)
    .then(location => {
      // console.log('27', location);
      response.send(location)
    })
    .catch(error => handleError(error, response));
})

// Do not comment in until you have locations in the DB
app.get('/weather', getWeather);

// Do not comment in until weather is working
// app.get('/meetups', getMeetups);

//do not comment in until movies is working
// app.get('/movies', getMovies)

//do not comment in until trails is working
app.get('/trails', getTrails)

//do not comment in until yelp is working.
// app.get('/yelp', getYelp)

// Make sure the server is listening for requests
app.listen(PORT, () => console.log(`Listening on ${PORT}`));

// *********************
// MODELS
// *********************

function Location(query, res) {
  this.search_query = query;
  this.formatted_query = res.formatted_address;
  this.latitude = res.geometry.location.lat;
  this.longitude = res.geometry.location.lng;
}
function Movie(movie) {
  this.title = movie.title;
  this.released_on = movie.released_on
  this.total_votes = movie.total_votes
  this.average_votes = movie.average_votes
  this.popularity = movie.popularity
  this.image_url = movie.image_url
  this.overview = movie.overview
}
function Trail(trail) {
  this.tableName = 'Trails'
  this.link = trail.link;
  this.name = trail.name; //may need to adjust this per line 73
  this.location = trail.location;
  this.distance = trail.distance;
  this.condition_date = new Date(trail.condition_date).toString().slice(0, 15);
  this.condition_time = trail.condition_time;
  this.conditions = trail.conditions;
  this.stars = trail.stars;
  this.star_votes = trail.star_votes;
  this.summary = trail.summary;
}

function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}

function Meetup(meetup) {
  this.tableName = 'meetups';
  this.link = meetup.link;
  this.name = meetup.group.name;
  this.creation_date = new Date(meetup.group.created).toString().slice(0, 15);
  this.host = meetup.group.who;
  this.created_at = Date.now();
}
function Yelp(yelp) {
  this.tableName = 'yelp_reviews'
  this.link = yelp.link
  this.name = yelp.name
  this.rating = yelp.rating
  this.image_url = yelp.image_url
}

// *********************
// HELPER FUNCTIONS
// *********************

function handleError(err, res) {
  console.error(err);
  if (res) res.status(500).send('Sorry, something went wrong');
}

function getLocation(query) {
  // CREATE the query string to check for the existence of the location
  // console.log('log console')
  const SQL = `SELECT * FROM locations WHERE search_query=$1;`;
  const values = [query];

  // Make the query of the database
  return client.query(SQL, values)
    .then(result => {
      // Check to see if the location was found and return the results
      if (result.rowCount > 0) {
        // console.log('From SQL');
        return result.rows[0];

        // Otherwise get the location information from the Google API
      } else {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;

        return superagent.get(url)
          .then(data => {
            // console.log('FROM API line 90', data.body);
            // Throw an error if there is a problem with the API request
            if (!data.body.results.length) { throw 'no Data' }

            // Otherwise create an instance of Location
            else {
              let location = new Location(query, data.body.results[0]);
              // console.log('98', location);

              // Create a query string to INSERT a new record with the location data
              let newSQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING id;`;
              // console.log('102', newSQL)
              let newValues = Object.values(location);
              // console.log('104', newValues)

              // Add the record to the database
              return client.query(newSQL, newValues)
                .then(result => {
                  // console.log('108', result.rows);
                  // Attach the id of the newly created record to the instance of location.
                  // This will be used to connect the location to the other databases.
                  // console.log('114', result.rows[0].id)
                  location.id = result.rows[0].id;
                  return location;
                })
                .catch(console.error);
            }
          })
          // .catch(error => console.log('Error in SQL Call'));
      }
    });
}

function getWeather(request, response) {
  //create the query string to check for the existence of the location
  const SQL = `SELECT * FROM weathers WHERE location_id=$1;`;
  const values = [request.query.data.id];

  //make query of database
  return client.query(SQL , values)
    .then(result => {
      //check to see if location is in DB
      if(result.rowCount > 0){
        // console.log('from sql');
        response.send(result.rows);
        //otherwise get info from api
      }else {
        const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`;
        superagent.get(url)
          .then(result => {
            const weatherSummaries = result.body.daily.data.map(day => {
              const summary = new Weather(day);
              return summary;
            });
            let newSQL =`INSERT INTO weathers(forecast, time, location_id) VALUES ($1, $2, $3);`;
            // console.log('148', weatherSummaries); //array of objects
            weatherSummaries.forEach( summary => {
              let newValues = Object.values(summary);
              newValues.push(request.query.data.id);
              //add record to DB
              return client.query(newSQL, newValues)
                .then(result => {
                  console.log('155', result.rows)
                  //connect location id - used for other DB's
                })
                .catch(console.error);
            })
            response.send(weatherSummaries);
          })
          // .catch(error => handleError(error,response));
      }
    })
}

// function getMeetups (request, response) {
//   const SQL = `SELECT * FROM meetups WHERE location_id=$1;`;
//   const values = [request.query.data.id]
//   // console.log('testing line 173', request.query.data.id)
//   return client.query(SQL, values)
//     .then(result => {
//       if(result.rowCount > 0){
//         console.log('from SQL');
//         response.send(result.rows);
//         //otherwise get new data from api
//       } else {
//         const url = `https://api.meetup.com/find/upcoming_events?&sign=true&photo-host=public&lon=${request.query.data.longitude}&page=20&lat=${request.query.data.latitude}&key=${process.env.MEETUP_API_KEY}`;
//         // console.log(url)
//         superagent.get(url)
//           .then(result => {
//             const meetups = result.body.events.map(meetup => {
//               const event = new Meetup(meetup)
//               return event
//             });
//             let newSQL = `INSERT INTO meetups(link, name, creation_date, host, location_id) values ($1, $2, $3, $4, $5);`;
//             console.log('190', meetups)
//             meetups.forEach( meetup => {
//               let newValues = Object.values(meetup);
//               newValues.push(request.query.data.id);
//               return client.query(newSQL, newValues)
//                 .then(result => {
//                   console.log('197', result.rows)
//                   console.log('198', result.rows[0].id)

//                 })
//                 .catch(console.error);
//             })
//             response.send(meetups);
//           })
//           // .catch(error => handleError(error, response));
//       }
//     })
// }

function getTrails (request, response) {
  const SQL = `SELECT * FROM trails WHERE location_id=$1;`;
  const values = [request.query.data.id]

  return client.query(SQL, values)
    .then (result =>{
      if(result.rowCount > 0){
        response.send(result.rows);
      } else {
        const url = `https://www.hikingproject.com/data/get-trails?${request.query.data.longitude}&${request.query.data.longitude}&maxDistance=10&key=${process.env.TRAILS_API_KEY}`
        console.log(url);
        console.log(url);
        console.log(url);
        superagent.get(url)
          .then(result => {
            const trails = result.body.events.map(trail => {
              const event = new Trail(trail)
              return event
            });
            let newSQL = `INSERT INTO trails(link, name, location, distance, condition_date, condition_time, conditions, stars, star_votes, summary) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10);`;
            trails.forEach( trail => {
              let newValues = Object.values(trail);
              newValues.push(request.query.data.id);
              return client.query(newSQL, newValues)
                .then( result => {
                  // console.log('255', result.rows)
                  // console.log('255', result.rows[0].id)
                })
                // .catch(console.error)
            })
            response.send(trails);
          })
          // .catch(error => handleError(error, response))
      }
    })
}
// function getMovies(request, response) {
//   const SQL = `SELECT * FROM movies WHERE location_id=$1;`;
//   const values = [request.query.data.id]

//   return client.query(SQL, values)
//     .then (result =>{
//       if(result.rowCount > 0){
//         response.send(result.rows);
//       }else {


//         const url = `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.MEETUP_API_KEY}&language=de-DE&region=DE&release_date.gte=2016-11-16&release_date.lte=2016-12-02&with_release_type=2|3`


//         console.log(url)
//         superagent.get(url)
//           .then(result => {
//             const movies = result.body.events.map(movie => {
//               const event = new Movie(movie)
//               return event
//             });
//             let newSQL = `INSERT INTO movies (title, released_on, total_votes, title, average_votes, popularity, image_url, overview) values ($1, $2, $3, $4, $5, $6, $7, $8);`;
//             movies.forEach(movie => {
//               let newValues = Object.values(movie);
//               return client.query(newSQL, newValues)
//                 .then(result => {
//                   console.log('297', result.rows)
//                   console.log('298', result.rows[0].id)
//                 })
//                 .catch(console.error);
//             })
//             response.send(movies);
//           })
//         //.catch(error => handleError(error,response))
//       }
//     })

// }

// function getYelp(request, response) {
//   const SQL = `SELECT * FROM yelp WHERE location_id$1;`;
//   const values = [request.query.data.id]

//   return client.query(SQL, value)
//     .then(result => {
//       if(result.rows > 0) {
//         response.send(result.rows)
//       }else {
//         const url = `https://api.yelp.com/v3/transactions/delivery/search?${request.query.data.latitude}&${request.query.data.longitude}`


//         console.log(url)
//         superagent.get(url)
//           .then(result => {
//             const yelps = result.body.events.map(yelp => {
//               const event = new Yelp(yelp)
//               return event
//             });
//             let newSQL = `INSERT INTO yelp (name, rating, image_url) values ($1,$2,$3);`;
//             yelps.forEach(yelp => {
//               let newValues = Object.values(yelp);
//               return client.query(newSQL, newValues)
//                 .then(result => {
//                   console.log('338', result.rows)
//                   console.log('339', result.rows[0].id)
//                 })
//                 .catch(console.error)
//             })
//             response.send(yelps);
//           })
//       }
//     })
// }

