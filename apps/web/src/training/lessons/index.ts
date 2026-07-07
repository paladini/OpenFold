import type { LessonScript } from '../lessonTypes'
import { lesson as oppositionRuleLesson } from './oppositionRule.lesson'
import { lesson as orientationRuleLesson } from './orientationRule.lesson'

/** Adding a lesson is a content-only change: define a LessonScript and list it here. */
export const LESSONS: readonly LessonScript[] = [oppositionRuleLesson, orientationRuleLesson]
