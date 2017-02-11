var express = require('express')
var utils = require('./utils.js')
var db = require('./db.js')
var router = express.Router()

router.use('*', (req, res, next) => {
  if (req.locals.user == 'flo') {
		next()
	} else {
		res.json({
			err: {
				type: 'internal',
				code: 4,
				msg: 'not_authorized'
			}
		})
	}
})

router.post('/app', (req, res) => {
  var token = utils.uid(256)
  res.json({
    token: token
  })
  db.addApplication(req.body.user, token, req.body.name, req.body.description)
})

router.get('/app', (req, res) => {
  db.getApplications((err, l) => {
    res.json(l)
  })
})

router.get('/recvmsgs', (req, res) => {
  db.getMsgsRecv((err, l) => {
    res.json(l)
  })
})

router.get('/recvcalls', (req, res) => {
  db.getCallsRecv((err, l) => {
    res.json(l)
  })
})

router.get('/sentmsgs', (req, res) => {
  db.getMsgs(req.query.user, (err, l) => {
    res.json(l)
  })
})

router.get('/sentcalls', (req, res) => {
  db.getCalls(req.query.user, (err, l) => {
    res.json(l)
  })
})

router.get('/subscriptions', (req, res) => {
  db.getSubscriptions(req.query.user, (err, l) => {
    res.json(l)
  })
})

router.get('/transactions', (req, res) => {
  db.getTransactions(req.query.user, (err, l) => {
    res.json(l)
  })
})

module.exports = router
