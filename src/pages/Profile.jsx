const handleUpload = async (e) => {
  const file = e.target.files[0];

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = `${user.id}/${file.name}`;

  await supabase.storage
    .from("avatars")
    .upload(path, file);

  const { data } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  console.log(data.publicUrl);
}