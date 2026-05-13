import {
  Table,
  Column,
  Model,
  DataType,
  HasMany,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
  Default,
  Unique,
  CreatedAt,
  UpdatedAt,
} from "sequelize-typescript";
import { User } from "./User";
import { Floor } from "./Floor";

@Table({ tableName: "restaurants" })
export class Restaurant extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Unique
  @Column(DataType.STRING)
  declare slug: string;

  @Column(DataType.STRING)
  declare name: string;

  @Column(DataType.TEXT)
  declare description: string | null;

  @Column(DataType.STRING)
  declare address: string;

  @Column(DataType.STRING)
  declare phone: string;

  @Column(DataType.STRING)
  declare email: string;

  @Column(DataType.STRING)
  declare notificationEmail: string | null;

  @Column(DataType.STRING)
  declare smtpHost: string | null;

  @Column(DataType.INTEGER)
  declare smtpPort: number | null;

  @Column(DataType.STRING)
  declare smtpUser: string | null;

  @Column(DataType.STRING)
  declare smtpPass: string | null;

  @Column(DataType.STRING)
  declare cuisine: string | null;

  @Column(DataType.STRING)
  declare openTime: string;

  @Column(DataType.STRING)
  declare closeTime: string;

  @Unique
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare ownerId: string;

  @BelongsTo(() => User)
  declare owner: User;

  @HasMany(() => Floor)
  declare floors: Floor[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
