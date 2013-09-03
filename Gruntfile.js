module.exports = function(grunt) {

	grunt.config.init({
		concat: {
			dist: {
				src: [
					'src/lib/polyfills.js',
					'src/lib/dom.js',
					'src/lib/util.js',
					'src/lib/template.js',
					'src/microbox.js'
				],
				dest: 'dist/microbox.min.js'
			}
		},
		wrap: true
	});

	grunt.loadNpmTasks('grunt-contrib-concat');

	//grunt.loadNpmTasks('grunt-contrib-uglify');

	grunt.registerTask('default', ['concat']);

};