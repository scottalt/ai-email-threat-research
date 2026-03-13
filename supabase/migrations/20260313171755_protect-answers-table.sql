-- Protect the answers table from accidental DELETE and TRUNCATE.
-- Must be deliberately dropped before any data cleanup.

CREATE OR REPLACE FUNCTION prevent_answer_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Direct deletion from answers table is blocked. Use admin override if necessary.';
END;
$$ LANGUAGE plpgsql;

-- Row-level: blocks individual DELETEs
CREATE TRIGGER protect_answers_delete
  BEFORE DELETE ON answers
  FOR EACH ROW EXECUTE FUNCTION prevent_answer_deletion();

-- Statement-level: blocks TRUNCATE
CREATE TRIGGER protect_answers_truncate
  BEFORE TRUNCATE ON answers
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_answer_deletion();
