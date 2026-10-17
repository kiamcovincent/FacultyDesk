function getTeacherIds(user, requestedTeacherIds = []) {
  return user.role === 'teacher' ? [user._id] : requestedTeacherIds;
}

function getTeacherScheduleId(user, requestedTeacherId) {
  return user.role === 'teacher' ? user._id : requestedTeacherId;
}

function getSubjectScheduleFilter(user, subjectId) {
  return {
    _id: subjectId,
    active: true,
    ...(user.role === 'teacher' ? { teachers: user._id } : {}),
  };
}

module.exports = { getSubjectScheduleFilter, getTeacherIds, getTeacherScheduleId };