// Save an episode to the database
QUERY saveEpisode(name: String, content: String, source: String, 
                userId: String,
                 createdAt: I64, space: String, episodeType: String,
                 sessionId: String, validAt: I64, embedding: [F64]) =>
    episode <- AddV<Episode>(embedding, {
        name: name,
        content: content,
        source: source,
        userId: userId,
        createdAt: createdAt,
        space: space,
        sessionId: sessionId,
        episodeType: episodeType,
        validAt: validAt
    })
    RETURN episode
