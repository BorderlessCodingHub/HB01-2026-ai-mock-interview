-- Keep review-session snapshots when the live study-list item is deleted.
ALTER TABLE "review_session_items" DROP CONSTRAINT "review_session_items_review_item_id_fkey";

ALTER TABLE "review_session_items" ALTER COLUMN "review_item_id" DROP NOT NULL;

ALTER TABLE "review_session_items" ADD CONSTRAINT "review_session_items_review_item_id_fkey" FOREIGN KEY ("review_item_id") REFERENCES "review_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
