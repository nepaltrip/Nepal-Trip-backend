const VibeInteraction = require("../models/VibeInteraction");

// ✨ 1. Extract the aggregation logic into its own function
const getVibeStats = async () => {
    return await VibeInteraction.aggregate([
        {
            // ✨ Phase 1: Group by Vibe AND UserId to sum time per person
            $group: {
                _id: { vibe: "$vibe", userId: "$userId" },
                userTotalTime: { $sum: "$duration" },
                clicks: { $sum: 1 },
                galleryConversions: { $sum: { $cond: ["$galleryClicked", 1, 0] } },
                isBounceSum: { $sum: { $cond: ["$isBounce", 1, 0] } },
                rawDuration: { $sum: "$duration" }
            }
        },
        {
            // ✨ Phase 2: Lookup user details from the DB
            $lookup: {
                from: "users", // Must match your User collection name in MongoDB
                localField: "_id.userId",
                foreignField: "_id",
                as: "userDoc"
            }
        },
        { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },
        {
            // ✨ Phase 3: Sort by time descending BEFORE regrouping (critical for Top 5)
            $sort: { userTotalTime: -1 }
        },
        {
            // ✨ Phase 4: Group back up to the Vibe level
            $group: {
                _id: "$_id.vibe",
                clicks: { $sum: "$clicks" },
                galleryConversions: { $sum: "$galleryConversions" },
                totalBounces: { $sum: "$isBounceSum" },
                totalDuration: { $sum: "$rawDuration" },
                allUsers: {
                    $push: {
                        $cond: [
                            { $ne: ["$_id.userId", null] }, // Only push registered users
                            {
                                id: "$_id.userId",
                                name: "$userDoc.name",
                                email: "$userDoc.email",
                                photo: "$userDoc.photo", // Change if your schema uses 'profilePic'
                                timeSpent: "$userTotalTime"
                            },
                            "$$REMOVE"
                        ]
                    }
                }
            }
        },
        {
            // ✨ Phase 5: Project final math & slice the top 5
            $project: {
                _id: 0,
                vibe: "$_id",
                clicks: 1,
                galleryConversions: 1,
                avgDurationSeconds: { $divide: ["$totalDuration", { $max: ["$clicks", 1] }] },
                bounceRateRaw: { $divide: ["$totalBounces", { $max: ["$clicks", 1] }] },
                topUsers: { $slice: ["$allUsers", 5] } // Grabs top 5 from the sorted push
            }
        },
        {
            // ✨ Phase 6: Format strings for the UI
            $project: {
                vibe: 1,
                clicks: 1,
                galleryConversions: 1,
                topUsers: 1,
                avgTime: {
                    $concat: [
                        { $toString: { $floor: { $divide: ["$avgDurationSeconds", 60] } } }, "m ",
                        { $toString: { $floor: { $mod: ["$avgDurationSeconds", 60] } } }, "s"
                    ]
                },
                bounceRate: {
                    $concat: [
                        { $toString: { $round: [{ $multiply: ["$bounceRateRaw", 100] }, 0] } }, "%"
                    ]
                }
            }
        },
        { $sort: { clicks: -1 } }
    ]);
};

// ✨ 2. Update the broadcast function to use the separated logic
const broadcastVibeMetrics = async (io) => {
    if (!io) return;

    try {
        const stats = await getVibeStats();
        io.to('admin_room').emit('vibe_intent_update', stats);
    } catch (error) {
        console.error("Failed to broadcast vibe telemetry:", error);
    }
};

// ✨ 3. Export both functions
module.exports = { broadcastVibeMetrics, getVibeStats };