// Knowledge Graph Schema: Combines reified relationships with temporal graph memory
// This schema implements a hybrid approach that allows for:
//  1. Representing facts as first-class entities (reification)
//  2. Tracking temporal validity of information
//  3. Maintaining provenance (where information came from)
//  4. Supporting direct entity-to-entity relationships for performance


V::Episode {
    name: String,
    content: String,
    source: String,
    episodeType: String,
    userId: String,
    createdAt: I64,
    validAt: I64,
    labels: [String],
    space: String,
    sessionId: String
}

V::Entity {
    name: String,
    summary: String,
    entityType: String,
    createdAt: Date,
    attributes: String,
    userId: String,
    space: String
}

// Statement node is the core of reification - turning facts into first-class objects
// This allows tracking validity periods, provenance, and treating facts as objects themselves
V::Statement {
    fact: String,
    createdAt: Date,
    validAt: Date,
    invalidAt: Date,
    attributes: String,
    userId: String,
    space: String
}

// Subject of the statement (the entity the statement is about)
E::HasSubject {
    From: Statement,
    To: Entity,
    Properties: {
        createdAt: Date
    }
}

// Object of the statement (the entity that receives the action or is related to)
E::HasObject {
    From: Statement,
    To: Entity,
    Properties: {
        createdAt: Date
    }
}

// Predicate of the statement (the relationship type or verb)
E::HasPredicate {
    From: Statement,
    To: Entity,
    Properties: {
        createdAt: Date
    }
}

// Provenance connection - links a statement to its source episode
E::HasProvenance {
    From: Statement,
    To: Episode,
    Properties: {
        createdAt: Date
    }
}