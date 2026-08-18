SELECT (SELECT count(*) FROM "User") AS users,
       (SELECT count(*) FROM "Post") AS posts,
       (SELECT count(*) FROM "FriendRequest") AS friends,
       (SELECT count(*) FROM "Message") AS messages;