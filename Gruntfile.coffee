module.exports = (grunt) ->

	grunt.config.init

		# concat:
		# 	dist:
		# 		src: [
		# 			'src/$.js',
		# 			'src/draggable.js'
		# 		],
		# 		dest: 'dist/draggable.min.js'

		uglify:
			options:
				mangle:
					toplevel: true
				compress:
					dead_code: true
					unused: true
					join_vars: true
				comments: false
			standard:
				files:
					'dist/draggable.min.js': [
						'src/$.js',
						'src/draggable.js'
					]
			no$:
				files:
					'dist/draggable.no$.min.js': [
						'src/draggable.js'
					]
		#wrap: true

	grunt.loadNpmTasks 'grunt-contrib-concat'
	grunt.loadNpmTasks 'grunt-contrib-uglify'

	grunt.registerTask 'default', ['uglify']
	grunt.registerTask 'no$', ['uglify:no$']