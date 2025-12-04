import { MatchingService } from '../services/MatchingService.js';
import { Skill } from '../models/Skill.js';
import { Degree } from '../models/Degree.js';

export class SearchController {
    async search(req, res, router) {
        try {
            const { skillId, major, blockName, yearOfStudy } = req.query;

            const criteria = {};
            if (skillId) criteria.skillId = parseInt(skillId);
            if (major) criteria.major = major;
            if (blockName) criteria.blockName = blockName;
            if (yearOfStudy) criteria.yearOfStudy = parseInt(yearOfStudy);

            const result = await MatchingService.searchTutors(criteria);
            router.sendJson(res, result);
        } catch (error) {
            console.error('Error searching tutors:', error);
            router.sendJson(res, { tutors: [], total: 0, error: 'Search failed' }, 500);
        }
    }

    async getSkills(req, res, router) {
        try {
            const skills = await Skill.findAll();
            const categories = await Skill.getCategories();
            router.sendJson(res, { skills, categories });
        } catch (error) {
            console.error('Error getting skills:', error);
            router.sendJson(res, { skills: [], categories: [] }, 500);
        }
    }

    async getDegrees(req, res, router) {
        try {
            const degrees = await Degree.findAll();
            router.sendJson(res, { degrees });
        } catch (error) {
            console.error('Error getting degrees:', error);
            router.sendJson(res, { degrees: [] }, 500);
        }
    }
}
