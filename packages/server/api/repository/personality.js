const Personality = require("../model/personalityModel");
const ClaimReview = require("../model/claimReviewModel");

const optionsToUpdate = {
    new: true,
    upsert: true
};

/**
 * @class PersonalityRepository
 */
module.exports = class PersonalityRepository {
    static async listAll(page, pageSize, order, query) {
        return Personality.find(query)
            .skip(page * pageSize)
            .limit(pageSize)
            .sort({ createdAt: order })
            .lean();
    }

    static create(personality) {
        const newPersonality = new Personality(personality);
        return newPersonality.save();
    }

    static async getById(personalityId) {
        const personality = await Personality.findById(personalityId).populate({
            path: "claims",
            select: "_id title"
        });
        if (personality) {
            const stats = await this.getReviewStats(personalityId);
            return Object.assign(personality.toObject(), { stats });
        }
        return personality;
    }

    static async getReviewStatsByClaims(id) {
        const personality = await Personality.findById(id);
        return Promise.all(
            personality.claims.map(async claimId => {
                const reviews = await ClaimReview.aggregate([
                    { $match: { claim: claimId } },
                    { $group: { _id: "$classification", count: { $sum: 1 } } }
                ]);

                return { claimId, reviews };
            })
        ).then(result => {
            return result;
        });
    }

    static async getReviewStats(id) {
        const personality = await Personality.findById(id);
        const reviews = await ClaimReview.aggregate([
            { $match: { personality: personality._id } },
            { $group: { _id: "$classification", count: { $sum: 1 } } }
        ]);
        const total = reviews.reduce((agg, review) => {
            agg += review.count;
            return agg;
        }, 0);
        const result = reviews.map(review => {
            const percentage = (review.count / total) * 100;
            return { _id: review._id, percentage };
        });
        return { total, reviews: result };
    }

    static async update(personalityId, personalityBody) {
        // eslint-disable-next-line no-useless-catch
        try {
            const personality = await this.getById(personalityId);
            const newPersonality = Object.assign(personality, personalityBody);
            const personalityUpdate = await Personality.findByIdAndUpdate(
                personalityId,
                newPersonality,
                optionsToUpdate
            );
            return personalityUpdate;
        } catch (error) {
            // TODO: log to service-runner
            throw error;
        }
    }

    static delete(personalityId) {
        return Personality.findByIdAndRemove(personalityId);
    }

    static count(query) {
        return Personality.countDocuments().where(query);
    }
};
