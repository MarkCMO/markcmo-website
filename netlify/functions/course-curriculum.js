// course-curriculum.js
// Returns curriculum structure (modules + lesson titles) for a given course.
// Used by the preview page to render the full syllabus without loading lesson content.
// GET ?course=cmo  →  { title, context, modules: [{ id, title, lessons: [{ id, title }] }] }

const { CURRICULUM } = require('./course-lesson.js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const courseId = (event.queryStringParameters || {}).course;

  if (!courseId || !CURRICULUM[courseId]) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Course not found' })
    };
  }

  const course = CURRICULUM[courseId];

  // Return only structural data - no lesson content
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      id: courseId,
      title: course.title,
      context: course.context,
      modules: course.modules.map(m => ({
        id: m.id,
        title: m.title,
        lessons: m.lessons.map(l => ({ id: l.id, title: l.title }))
      }))
    })
  };
};
