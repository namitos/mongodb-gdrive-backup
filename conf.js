module.exports = {
	mongo: {
		host: "mongo",
		port: 27017,
		db: ''
	},
	googleServiceAccount: {
		//todo insert here JWT
	},
	backup: {
		shareTo: '',//todo insert here email
		interval: 1000 * 60 * 60 * 4,
		deleteTimeout: 14,
		fileName: 'Backup'
	}
};