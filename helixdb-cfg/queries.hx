// Save an episode to the database
QUERY saveEpisode(uuid: String, name: String, content: String, source: String, 
                 sourceDescription: String, userId: String, labels: [String],
                 createdAt: String, validAt: String, embedding: [F32]) =>
    episode <- AddV<Episode>({
        uuid: uuid,
        name: name,
        content: content,
        source: source,
        sourceDescription: sourceDescription,
        userId: userId,
        labels: labels,
        createdAt: createdAt,
        validAt: validAt,
        embedding: embedding
    })
    RETURN episode

// Get a specific episode by UUID
QUERY getEpisode(uuid: String) =>
    episode <- V<Episode>(uuid)
    RETURN episode

// Get recent episodes with optional filters
QUERY getRecentEpisodes(referenceTime: String, limit: I32, userId: String, source: String) =>
    episodes <- V<Episode>::WHERE(_::{validAt}::LTE(referenceTime))
    // Apply filters if provided
    episodes <- IF userId != NULL THEN episodes::WHERE(_::{userId}::EQ(userId)) ELSE episodes
    episodes <- IF source != NULL THEN episodes::WHERE(_::{source}::EQ(source)) ELSE episodes
    // Sort and limit
    episodes <- episodes::Sort({validAt: -1})::Limit(limit)
    RETURN episodes

// Save an entity node
QUERY saveEntity(uuid: String, name: String, summary: String, 
                userId: String, createdAt: String, attributesJson: String, embedding: [F32]) =>
    entity <- AddV<Entity>({
        uuid: uuid,
        name: name,
        summary: summary,
        userId: userId,
        createdAt: createdAt,
        attributesJson: attributesJson,
        embedding: embedding
    })
    RETURN entity

// Get an entity by UUID
QUERY getEntity(uuid: String) =>
    entity <- V<Entity>(uuid)
    RETURN entity

// Save a statement with temporal information
QUERY saveStatement(uuid: String, fact: String, groupId: String, userId: String,
                  createdAt: String, validAt: String, invalidAt: String, 
                  attributesJson: String, embedding: [F32]) =>
    statement <- AddV<Statement>({
        uuid: uuid,
        fact: fact,
        groupId: groupId,
        userId: userId,
        createdAt: createdAt,
        validAt: validAt,
        invalidAt: invalidAt,
        attributesJson: attributesJson,
        embedding: embedding
    })
    RETURN statement

// Create HasSubject edge
QUERY createHasSubjectEdge(uuid: String, statementId: String, entityId: String, createdAt: String) =>
    statement <- V<Statement>(statementId)
    entity <- V<Entity>(entityId)
    edge <- AddE<HasSubject>::From(statement)::To(entity)({
        uuid: uuid,
        createdAt: createdAt
    })
    RETURN edge

// Create HasObject edge
QUERY createHasObjectEdge(uuid: String, statementId: String, entityId: String, createdAt: String) =>
    statement <- V<Statement>(statementId)
    entity <- V<Entity>(entityId)
    edge <- AddE<HasObject>::From(statement)::To(entity)({
        uuid: uuid,
        createdAt: createdAt
    })
    RETURN edge

// Create HasPredicate edge
QUERY createHasPredicateEdge(uuid: String, statementId: String, entityId: String, createdAt: String) =>
    statement <- V<Statement>(statementId)
    entity <- V<Entity>(entityId)
    edge <- AddE<HasPredicate>::From(statement)::To(entity)({
        uuid: uuid,
        createdAt: createdAt
    })
    RETURN edge

// Create HasProvenance edge
QUERY createHasProvenanceEdge(uuid: String, statementId: String, episodeId: String, createdAt: String) =>
    statement <- V<Statement>(statementId)
    episode <- V<Episode>(episodeId)
    edge <- AddE<HasProvenance>::From(statement)::To(episode)({
        uuid: uuid,
        createdAt: createdAt
    })
    RETURN edge

// Get all statements for a subject entity
QUERY getStatementsForSubject(entityId: String) =>
    entity <- V<Entity>(entityId)
    statements <- entity::In<HasSubject>
    RETURN statements

// Get all statements for an object entity
QUERY getStatementsForObject(entityId: String) =>
    entity <- V<Entity>(entityId)
    statements <- entity::In<HasObject>
    RETURN statements

// Get all statements with a specific predicate
QUERY getStatementsForPredicate(predicateId: String) =>
    predicate <- V<Entity>(predicateId)
    statements <- predicate::In<HasPredicate>
    RETURN statements

// Get all statements from an episode
QUERY getStatementsFromEpisode(episodeId: String) =>
    episode <- V<Episode>(episodeId)
    statements <- episode::In<HasProvenance>
    RETURN statements

// Get the complete subject-predicate-object triples for a statement
QUERY getTripleForStatement(statementId: String) =>
    statement <- V<Statement>(statementId)
    subject <- statement::Out<HasSubject>
    predicate <- statement::Out<HasPredicate>
    object <- statement::Out<HasObject>
    RETURN {
        statement: statement,
        subject: subject,
        predicate: predicate,
        object: object
    }

// Find all statements valid at a specific time
QUERY getStatementsValidAtTime(timestamp: String, userId: String) =>
    statements <- V<Statement>::WHERE(
        AND(
            _::{validAt}::LTE(timestamp),
            OR(
                _::{invalidAt}::GT(timestamp),
                _::{invalidAt}::EQ(NULL)
            )
        )
    )
    // Filter by userId if provided
    statements <- IF userId != NULL THEN 
        statements::WHERE(_::{userId}::EQ(userId)) 
    ELSE 
        statements
    RETURN statements

// Find contradictory statements (same subject and predicate but different objects)
QUERY findContradictoryStatements(subjectId: String, predicateId: String) =>
    subject <- V<Entity>(subjectId)
    predicate <- V<Entity>(predicateId)
    
    // Get all statements that have this subject
    statements <- subject::In<HasSubject>
    
    // Filter to those with the specified predicate
    statements <- statements::WHERE(
        _::Out<HasPredicate>::ID()::EQ(predicateId)
    )
    
    // Get all valid statements
    valid_statements <- statements::WHERE(
        OR(
            _::{invalidAt}::EQ(NULL),
            _::{invalidAt}::GT(NOW())
        )
    )
    
    RETURN valid_statements

// Find semantically similar entities using vector embeddings
QUERY findSimilarEntities(queryEmbedding: [F32], limit: I32, threshold: F32) =>
    entities <- V<Entity>::Neighbor<COSINE>(queryEmbedding, threshold)::Limit(limit)
    RETURN entities

// Find semantically similar statements using vector embeddings
QUERY findSimilarStatements(queryEmbedding: [F32], limit: I32, threshold: F32) =>
    statements <- V<Statement>::Neighbor<COSINE>(queryEmbedding, threshold)::Limit(limit)
    RETURN statements

// Retrieve a complete knowledge triple (subject, predicate, object) with temporal information
QUERY getTemporalTriple(statementId: String) =>
    statement <- V<Statement>(statementId)
    subject <- statement::Out<HasSubject>
    predicate <- statement::Out<HasPredicate>
    object <- statement::Out<HasObject>
    episode <- statement::Out<HasProvenance>
    
    RETURN {
        statement: {
            id: statement::{uuid},
            fact: statement::{fact},
            validAt: statement::{validAt},
            invalidAt: statement::{invalidAt},
            attributesJson: statement::{attributesJson}
        },
        subject: {
            id: subject::{uuid},
            name: subject::{name}
        },
        predicate: {
            id: predicate::{uuid},
            name: predicate::{name}
        },
        object: {
            id: object::{uuid},
            name: object::{name}
        },
        provenance: {
            id: episode::{uuid},
            name: episode::{name}
        }
    }
