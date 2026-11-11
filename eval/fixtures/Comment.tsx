import moment from "moment";

type CommentProps = { author: string; avatarUrl: string; text: string; createdAt: string };

export function Comment({ author, avatarUrl, text, createdAt }: CommentProps) {
  return (
    <article className="comment">
      <img src={avatarUrl} alt={author} className="avatar" />
      <div>
        <strong>{author}</strong>
        <time dateTime={createdAt}>{moment(createdAt).fromNow()}</time>
        <p>{text}</p>
      </div>
    </article>
  );
}
