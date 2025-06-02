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
    type: String,
    userId: String,
    createdAt: DateTime,
    validAt: DateTime,
    labels: Array<String>,
    space: String,
    sessionId: String
}

V::Entity {
    name: String,
    summary: String,
    type: String,
    createdAt: DateTime,
    attributes: String
    userId: String,
    space: String
}

// Statement node is the core of reification - turning facts into first-class objects
// This allows tracking validity periods, provenance, and treating facts as objects themselves
V::Statement {
    fact: String,
    createdAt: DateTime,
    validAt: DateTime,
    invalidAt: DateTime,
    attributes: String
    userId: String,
    space: String
}

// Subject of the statement (the entity the statement is about)
E::HasSubject {
    To: Entity,
    From: Statement,
    Properties: {
        createdAt: DateTime
    }
}

// Object of the statement (the entity that receives the action or is related to)
E::HasObject {
    To: Entity,
    From: Statement,
    Properties: {
        createdAt: DateTime
    }
}

// Predicate of the statement (the relationship type or verb)
E::HasPredicate {
    To: Entity,
    From: Statement,
    Properties: {
        createdAt: DateTime
    }
}

// Provenance connection - links a statement to its source episode
E::HasProvenance {
    To: Episode,
    From: Statement,
    Properties: {
        createdAt: DateTime
    }
}