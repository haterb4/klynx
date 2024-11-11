# La persistance
Voici un exemple d'utilisation :

```typescript
// Exemple de définition d'un modèle User
@table('users')
class User extends Model {
  @column({ type: 'string', unique: true })
  email: string;

  @column({ type: 'string' })
  name: string;

  @column({ type: 'boolean', default: false })
  isActive: boolean;

  @relation({
    type: 'hasMany',
    model: () => Post
  })
  posts: Post[];
}

// Exemple de définition d'un modèle Post
@table('posts')
class Post extends Model {
  @column({ type: 'string' })
  title: string;

  @column({ type: 'string' })
  content: string;

  @column({ type: 'number' })
  userId: number;

  @relation({
    type: 'belongsTo',
    model: () => User
  })
  user: User;
}

// Exemple d'utilisation dans un contrôleur
@controller('/users')
class UserController extends BaseController {
  @httpGet('/')
  async getAllUsers(req: Request, res: Response): Promise<void> {
    const users = await User.findAll({ isActive: true });
    
    // Charger les posts pour chaque utilisateur
    for (const user of users) {
      user.posts = await user.load('posts');
    }
    
    this.ok(res, users);
  }

  @httpPost('/')
  async createUser(req: Request, res: Response): Promise<void> {
    const user = new User();
    user.email = req.body.email;
    user.name = req.body.name;
    await user.save();
    
    this.created(res);
  }
}
```

Les avantages de cette approche sont :

1. **Plus direct** : Vous travaillez directement avec les modèles sans passer par des repositories ou managers
2. **Plus simple** : L'API est plus intuitive et ressemble à ce qu'on trouve dans des frameworks populaires comme Laravel
3. **Plus flexible** : Facile à étendre avec des méthodes personnalisées sur les modèles
4. **Moins de boilerplate** : Moins de code à écrire pour faire des opérations simples

Pour l'intégrer à votre framework :

1. Ajoutez la connexion à la base de données dans votre `createApp.ts` :

```typescript
// Dans createApp.ts
if (options.databaseConfig) {
  const dbConnection = new DatabaseConnection(options.databaseConfig);
  await dbConnection.connect();
  Model.setConnection(dbConnection);
}
```